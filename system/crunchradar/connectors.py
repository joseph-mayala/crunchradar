"""Connectors. Each one is the stand-in for a real system and works the same way when pointed at the real thing.

  Calendar feed  -> Moodle/Google Calendar ICS (URL or file). In Gemini Enterprise: Google Calendar connector.
  Briefs folder  -> Google Drive folder of brief text. In Gemini Enterprise: Google Drive connector.
  Mailer         -> SMTP (Outlook/Gmail). With no SMTP settings, mail goes to an outbox that is stored and shown, never lost.
"""
import re
import smtplib
import urllib.request
from datetime import date, datetime
from email.message import EmailMessage
from pathlib import Path

from .config import Settings
from .models import Assessment, TYPES

_TYPE_WORDS = [("presentation", r"present|viva|demo"), ("test", r"test|exam"), ("quiz", r"quiz"), ("logbook", r"logbook"), ("report", r"report|essay|proposal"), ("code", r"code|project|assignment|website|program")]


def _read(src: str) -> str:
    if src.startswith(("http://", "https://")):
        with urllib.request.urlopen(src, timeout=15) as r:  # noqa: S310 (operator-configured URL)
            return r.read().decode("utf-8", "replace")
    return Path(src).read_text()


def _unfold(text: str) -> list[str]:
    out: list[str] = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def week_of(d: date, s: Settings) -> int:
    return (d - s.semester_start).days // 7 + 1


def read_calendar(s: Settings) -> list[Assessment]:
    """Parse VEVENTs into Assessments. Attributes come from DESCRIPTION 'key: value; ...' and fall back to keywords in the title."""
    lines = _unfold(_read(s.ics_source()))
    events, cur = [], None
    for ln in lines:
        if ln == "BEGIN:VEVENT":
            cur = {}
        elif ln == "END:VEVENT" and cur is not None:
            events.append(cur)
            cur = None
        elif cur is not None and ":" in ln:
            key, val = ln.split(":", 1)
            cur[key.split(";")[0].upper()] = val.strip()
    items = []
    for i, e in enumerate(events):
        summary = e.get("SUMMARY", "Untitled")
        m = re.match(r"\[([A-Za-z0-9]+)\]\s*(.*)", summary)
        mod = e.get("CATEGORIES") or (m.group(1) if m else "UNK")
        title = m.group(2) if m else summary
        attrs = {k.strip().lower(): v.strip() for k, v in (p.split(":", 1) for p in e.get("DESCRIPTION", "").split(";") if ":" in p)}
        typ = attrs.get("type") or next((t for t, rx in _TYPE_WORDS if re.search(rx, title, re.I)), "report")
        if typ not in TYPES:
            typ = "report"
        raw = e.get("DTSTART", "")[:8]
        try:
            due = week_of(datetime.strptime(raw, "%Y%m%d").date(), s)
        except ValueError:
            continue
        if not 1 <= due <= s.weeks:
            continue
        items.append(Assessment(
            id=attrs.get("id") or e.get("UID", f"e{i}").split("@")[0], mod=mod, title=title, type=typ,
            weight=float(attrs.get("weight") or 0), words=int(float(attrs.get("words") or 0)),
            group=attrs.get("group", "no").lower() in ("yes", "true", "1"), due=due,
            fixed=attrs.get("fixed", "no").lower() in ("yes", "true", "1"),
            feedback=int(attrs["feedback"]) if attrs.get("feedback", "").isdigit() else None))
    return items


def read_briefs(s: Settings) -> dict[str, str]:
    """assessment id -> brief text, from files named <id>.txt / <id>.md."""
    d = s.briefs_source()
    if not d.exists():
        return {}
    return {f.stem: f.read_text() for f in sorted(d.iterdir()) if f.suffix in (".txt", ".md")}


# ---------- Mail ----------
class Mailer:
    def __init__(self, s: Settings, store):
        self.s, self.store = s, store

    def send(self, to: str, subject: str, body: str, kind: str = "mail", cc: str = "", record_to: str = "") -> dict:
        """Send for real if SMTP is configured, otherwise record it in the outbox. Returns {'sent': bool}.
        `record_to` replaces the address in the stored record (student emails are never stored in plain text)."""
        sent, err = False, ""
        if self.s.smtp_host and self.s.smtp_user:
            try:
                msg = EmailMessage()
                msg["From"], msg["To"], msg["Subject"] = self.s.mail_from, to, subject
                if cc:
                    msg["Cc"] = cc
                msg.set_content(body)
                with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=15) as smtp:
                    smtp.starttls()
                    smtp.login(self.s.smtp_user, self.s.smtp_password)
                    smtp.send_message(msg)
                sent = True
            except Exception as e:  # noqa: BLE001 - never lose the message
                err = f"{type(e).__name__}: {e}"
        if record_to:
            err = err.replace(to, record_to)
        self.store.add_outbox(record_to or to, cc, subject, body, kind, sent, err)
        return {"sent": sent, "error": err}
