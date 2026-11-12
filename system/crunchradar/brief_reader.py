"""Find the tasks inside an assignment brief. Gemini when a key is set, plain rules otherwise (or if the call fails).

Gemini only suggests. Whatever it returns is clamped here, and the rules engine decides what happens next.
"""
import json
import re
import urllib.error
import urllib.request

from .config import Settings
from .models import TYPES

_RULES = [("presentation", r"demo|viva|present|pitch"), ("report", r"report|essay|proposal"), ("quiz", r"quiz"), ("test", r"test|exam"), ("logbook", r"logbook"), ("code", r"code|build|program|implement|website|system")]


def read_with_rules(text: str, weeks: int = 14) -> list[dict]:
    out = []
    for sent in re.split(r"(?<=[.!?])\s+|\n+", text):
        wk = re.search(r"week\s*(\d{1,2})", sent, re.I)
        if not wk or not 1 <= int(wk.group(1)) <= weeks:
            continue
        typ = next((t for t, rx in _RULES if re.search(rx, sent, re.I)), None)
        if not typ:
            continue
        w = re.search(r"([\d,]{3,6})\s*-?\s*words?", sent, re.I)
        out.append({"title": sent.strip()[:80], "type": typ, "week": int(wk.group(1)), "words": int(w.group(1).replace(",", "")) if w else 0,
                    "group": bool(re.search(r"\bgroup|team\b", sent, re.I)), "hours": None, "why": "matched keywords and a week number", "source": "rules"})
    return out


def _clamp(tasks, weeks: int) -> list[dict]:
    clean = []
    for t in tasks[:12] if isinstance(tasks, list) else []:
        if not isinstance(t, dict) or t.get("type") not in TYPES:
            continue
        try:
            wk = int(t["week"])
            hrs = float(t.get("hours") or 0)
            words = int(float(t.get("words") or 0))
        except (KeyError, TypeError, ValueError):
            continue
        if not 1 <= wk <= weeks:
            continue
        clean.append({"title": str(t.get("title", "Task"))[:80], "type": t["type"], "week": wk, "words": max(0, min(10000, words)), "group": bool(t.get("group")),
                      "hours": max(0.5, min(60.0, hrs)) if hrs else None, "why": str(t.get("why", ""))[:160], "source": "gemini"})
    return clean


PROMPT = ('You read a university assignment brief. List every task a student must do, including ones only mentioned in passing (demos, vivas, presentations, peer reviews). '
          'Return JSON only: {"tasks":[{"title":string,"type":"code"|"report"|"presentation"|"test"|"quiz"|"logbook","week":integer 1-14,"words":integer,"group":boolean,"hours":number,"why":string}]}. '
          '"hours" is your estimate of student effort and "why" is one short sentence.\n\nBrief:\n')


def read_with_gemini(text: str, s: Settings) -> list[dict]:
    body = json.dumps({"contents": [{"parts": [{"text": PROMPT + text}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}).encode()
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent", data=body,
                                 headers={"Content-Type": "application/json", "x-goog-api-key": s.gemini_key})
    with urllib.request.urlopen(req, timeout=s.gemini_timeout) as r:  # noqa: S310
        data = json.load(r)
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return _clamp(json.loads(raw)["tasks"], s.weeks)


def read_brief(text: str, s: Settings) -> dict:
    """Returns {'tasks': [...], 'mode': 'gemini'|'rules', 'note': str}. Never raises."""
    if s.gemini_key:
        try:
            tasks = read_with_gemini(text, s)
            return {"tasks": tasks, "mode": "gemini", "note": ""}
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError, OSError) as e:
            return {"tasks": read_with_rules(text, s.weeks), "mode": "rules", "note": f"Gemini failed ({type(e).__name__}: {e}); used rules"}
    return {"tasks": read_with_rules(text, s.weeks), "mode": "rules", "note": "no GEMINI_API_KEY set; used rules"}
