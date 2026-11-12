"""SQLite state: run history, proposals and their approval trail, outbox, and 'too much' responses."""
import json
import secrets
import sqlite3
from datetime import datetime, timezone


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


SCHEMA = """
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, workflow TEXT, trigger TEXT, started TEXT, status TEXT, note TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS proposals(
  id INTEGER PRIMARY KEY, token TEXT UNIQUE, lec_token TEXT UNIQUE, run_id INTEGER, assess_id TEXT, mod TEXT, title TEXT,
  from_w INTEGER, to_w INTEGER, why TEXT, status TEXT, created TEXT, decided TEXT, decided_by TEXT, followup TEXT);
CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY, created TEXT, to_addr TEXT, cc TEXT, subject TEXT, body TEXT, kind TEXT, sent INTEGER, error TEXT);
CREATE TABLE IF NOT EXISTS pulse(student TEXT, week INTEGER, created TEXT, PRIMARY KEY(student, week));
CREATE TABLE IF NOT EXISTS pulse_alert(week INTEGER PRIMARY KEY, created TEXT);
"""


class Store:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=NORMAL")
        self.db.executescript(SCHEMA)

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
    def add_proposal(self, run_id: int, p: dict, why: str) -> dict:
        tok, lec = secrets.token_urlsafe(16), secrets.token_urlsafe(16)
        cur = self.db.execute("INSERT INTO proposals(token,lec_token,run_id,assess_id,mod,title,from_w,to_w,why,status,created) VALUES(?,?,?,?,?,?,?,?,?,'pending',?)",
                              (tok, lec, run_id, p["id"], p["mod"], p["title"], p["from"], p["to"], why, now()))
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
