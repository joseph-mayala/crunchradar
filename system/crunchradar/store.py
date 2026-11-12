"""SQLite state: run history, proposals and their approval trail, outbox, and 'too much' responses."""
import json
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


SCHEMA = """
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, workflow TEXT, trigger TEXT, started TEXT, status TEXT, note TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS proposals(
  id INTEGER PRIMARY KEY, token TEXT UNIQUE, lec_token TEXT UNIQUE, run_id INTEGER, assess_id TEXT, mod TEXT, title TEXT,
  from_w INTEGER, to_w INTEGER, why TEXT, status TEXT, created TEXT, decided TEXT, decided_by TEXT, followup TEXT, expires TEXT, lec_expires TEXT);
CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY, created TEXT, to_addr TEXT, cc TEXT, subject TEXT, body TEXT, kind TEXT, sent INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS pulse(student TEXT, week INTEGER, created TEXT, PRIMARY KEY(student, week));
CREATE TABLE IF NOT EXISTS brief_cache(key TEXT PRIMARY KEY, created TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS pulse_alert(week INTEGER PRIMARY KEY, created TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS extensions(
  id INTEGER PRIMARY KEY, student TEXT, contact TEXT, assess_id TEXT, mod TEXT, title TEXT, due_week INTEGER, days INTEGER, reason TEXT,
  personal_hours REAL, verdict TEXT, draft_days INTEGER, why TEXT, status TEXT, created TEXT, decided TEXT, decided_by TEXT, run_id INTEGER);
"""


class Store:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=NORMAL")
        self.db.executescript(SCHEMA)
        cols = {r[1] for r in self.db.execute("PRAGMA table_info(proposals)")}
        for c in ("expires", "lec_expires"):          # older databases
            if c not in cols:
                self.db.execute(f"ALTER TABLE proposals ADD COLUMN {c} TEXT")
        self.db.commit()

    # brief reader cache: a real Gemini reading of the same brief text is kept, so pages do not call the model on every load
    def cache_get(self, key: str) -> dict | None:
        r = self.db.execute("SELECT result FROM brief_cache WHERE key=?", (key,)).fetchone()
        return json.loads(r[0]) if r else None

    def cache_put(self, key: str, result: dict) -> None:
        self.db.execute("INSERT OR REPLACE INTO brief_cache(key,created,result) VALUES(?,?,?)", (key, now(), json.dumps(result)))
        self.db.commit()

    # runs
    def add_run(self, workflow: str, trigger: str, status: str, note: str, detail: dict | None = None) -> int:
        cur = self.db.execute("INSERT INTO runs(workflow,trigger,started,status,note,detail) VALUES(?,?,?,?,?,?)", (workflow, trigger, now(), status, note, json.dumps(detail or {})))
        self.db.commit()
        return cur.lastrowid

    def update_run(self, run_id: int, status: str, note: str, detail: dict | None = None) -> None:
        self.db.execute("UPDATE runs SET status=?, note=?, detail=? WHERE id=?", (status, note, json.dumps(detail or {}), run_id))
        self.db.commit()

    def runs(self, limit: int = 50) -> list[dict]:
        return [dict(r) for r in self.db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,))]

    # proposals
    def add_proposal(self, run_id: int, p: dict, why: str, ttl_hours: float = 72) -> dict:
        tok, lec = secrets.token_urlsafe(16), secrets.token_urlsafe(16)
        cur = self.db.execute("INSERT INTO proposals(token,lec_token,run_id,assess_id,mod,title,from_w,to_w,why,status,created,expires) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)",
                              (tok, lec, run_id, p["id"], p["mod"], p["title"], p["from"], p["to"], why, now(), (datetime.fromisoformat(now()) + timedelta(hours=ttl_hours)).isoformat(timespec="seconds")))
        self.db.commit()
        return self.proposal(cur.lastrowid)

    def proposal(self, id_: int) -> dict | None:
        r = self.db.execute("SELECT * FROM proposals WHERE id=?", (id_,)).fetchone()
        return dict(r) if r else None

    def proposal_by_token(self, token: str, col: str = "token") -> dict | None:
        assert col in ("token", "lec_token")
        r = self.db.execute(f"SELECT * FROM proposals WHERE {col}=?", (token,)).fetchone()
        return dict(r) if r else None

    def set_status(self, id_: int, status: str, by: str = "") -> None:
        self.db.execute("UPDATE proposals SET status=?, decided=?, decided_by=? WHERE id=?", (status, now(), by, id_))
        self.db.commit()

    def set_lec_expiry(self, id_: int, days: float) -> None:
        self.db.execute("UPDATE proposals SET lec_expires=? WHERE id=?", ((datetime.fromisoformat(now()) + timedelta(days=days)).isoformat(timespec="seconds"), id_))
        self.db.commit()

    @staticmethod
    def is_expired(stamp: str | None) -> bool:
        return bool(stamp) and datetime.fromisoformat(stamp) < datetime.fromisoformat(now())

    def expire_stale(self) -> int:
        """Pending proposals whose link has run out become 'expired' (they can be proposed again)."""
        n = 0
        for p in self.proposals("pending"):
            if self.is_expired(p.get("expires")):
                self.db.execute("UPDATE proposals SET status='expired', decided=?, decided_by='system: link expired' WHERE id=?", (now(), p["id"]))
                n += 1
        self.db.commit()
        return n

    def set_followup(self, id_: int, text: str) -> None:
        self.db.execute("UPDATE proposals SET followup=? WHERE id=?", (text, id_))
        self.db.commit()

    def proposals(self, status: str | None = None) -> list[dict]:
        q, a = ("SELECT * FROM proposals WHERE status=? ORDER BY id", (status,)) if status else ("SELECT * FROM proposals ORDER BY id", ())
        return [dict(r) for r in self.db.execute(q, a)]

    def rejected_keys(self) -> set[str]:
        return {f"{r['assess_id']}>{r['to_w']}" for r in self.proposals() if r["status"] in ("rejected", "declined")}

    def has_open(self, assess_id: str, to_w: int) -> bool:
        return any(r["assess_id"] == assess_id and r["to_w"] == to_w and r["status"] == "pending" for r in self.proposals())

    # outbox
    def add_outbox(self, to: str, cc: str, subject: str, body: str, kind: str, sent: bool, error: str) -> None:
        self.db.execute("INSERT INTO outbox(created,to_addr,cc,subject,body,kind,sent,error) VALUES(?,?,?,?,?,?,?,?)", (now(), to, cc, subject, body, kind, int(sent), error))
        self.db.commit()

    def outbox(self, limit: int = 50) -> list[dict]:
        return [dict(r) for r in self.db.execute("SELECT * FROM outbox ORDER BY id DESC LIMIT ?", (limit,))]

    # pulse ("this week is too much"): one response per student per week, enforced by the primary key
    def add_pulse(self, student: str, week: int) -> bool:
        try:
            self.db.execute("INSERT INTO pulse(student,week,created) VALUES(?,?,?)", (student, week, now()))
            self.db.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def pulse_count(self, week: int) -> int:
        return self.db.execute("SELECT COUNT(*) FROM pulse WHERE week=?", (week,)).fetchone()[0]

    def mark_pulse_alert(self, week: int) -> bool:
        try:
            self.db.execute("INSERT INTO pulse_alert(week,created) VALUES(?,?)", (week, now()))
            self.db.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def has_pulse(self, student: str, week: int) -> bool:
        return self.db.execute("SELECT 1 FROM pulse WHERE student=? AND week=?", (student, week)).fetchone() is not None

    # settings (operator assumptions), stored as JSON values
    def get_setting(self, key: str, default=None):
        r = self.db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default

    def set_setting(self, key: str, value) -> None:
        self.db.execute("INSERT INTO settings(key,value,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated", (key, json.dumps(value), now()))
        self.db.commit()

    def delete_setting(self, key: str) -> None:
        self.db.execute("DELETE FROM settings WHERE key=?", (key,))
        self.db.commit()

    # extension requests. `student` is a salted hash; `contact` is the sealed (encrypted) address, never plain text.
    def add_extension(self, row: dict) -> int:
        cols = ("student", "contact", "assess_id", "mod", "title", "due_week", "days", "reason", "personal_hours", "verdict", "draft_days", "why", "run_id")
        cur = self.db.execute(f"INSERT INTO extensions({','.join(cols)},status,created) VALUES({','.join('?' * len(cols))},'pending',?)",
                              tuple(json.dumps(row[c]) if c == "why" else row[c] for c in cols) + (now(),))
        self.db.commit()
        return cur.lastrowid

    def extension(self, id_: int) -> dict | None:
        r = self.db.execute("SELECT * FROM extensions WHERE id=?", (id_,)).fetchone()
        return self._ext(r) if r else None

    def extensions(self) -> list[dict]:
        return [self._ext(r) for r in self.db.execute("SELECT * FROM extensions ORDER BY id DESC")]

    @staticmethod
    def _ext(r) -> dict:
        d = dict(r)
        d["why"] = json.loads(d["why"] or "[]")
        return d

    def set_extension_status(self, id_: int, status: str, by: str) -> None:
        self.db.execute("UPDATE extensions SET status=?, decided=?, decided_by=? WHERE id=?", (status, now(), by, id_))
        self.db.commit()

    def extension_students(self, assess_id: str) -> int:
        return self.db.execute("SELECT COUNT(DISTINCT student) FROM extensions WHERE assess_id=?", (assess_id,)).fetchone()[0]

    def has_pending_extension(self, student: str, assess_id: str) -> bool:
        return self.db.execute("SELECT 1 FROM extensions WHERE student=? AND assess_id=? AND status='pending'", (student, assess_id)).fetchone() is not None

    def run(self, id_: int) -> dict | None:
        r = self.db.execute("SELECT * FROM runs WHERE id=?", (id_,)).fetchone()
        return dict(r) if r else None
