"""A real schedule: Monday 08:00 crunch check and 08:30 follow-up, Malaysia time, with nobody logged in.

Runs inside `crunchradar serve` (SCHEDULER=1). On hosts that scale to zero (Cloud Run), leave this off and call the
POST /workflows/* endpoints from Cloud Scheduler with the CRON_KEY header instead.
"""
import threading
import time
from datetime import datetime, timedelta, timezone

MYT = timezone(timedelta(hours=8))
JOBS = [("monday_check", "Monday crunch check", 8, 0), ("follow_up", "Follow-up", 8, 30)]   # (method, run name, hour, minute) every Monday MYT


def last_slot(now: datetime, hour: int, minute: int) -> datetime:
    """The most recent Monday hour:minute (Malaysia time) at or before now."""
    n = now.astimezone(MYT)
    slot = (n - timedelta(days=n.weekday())).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return slot if slot <= n else slot - timedelta(days=7)


def due(now_utc: datetime, runs: list[dict], baseline: datetime | None = None) -> list[tuple[str, bool]]:
    """Jobs to fire now as (method, was_missed). A job fires if no scheduled run has happened since its latest slot, so a host that was
    asleep or offline at 08:00 still runs the job when it comes back (catch-up), once per week and never twice."""
    out = []
    for method, name, h, m in JOBS:
        slot = last_slot(now_utc, h, m)
        if now_utc.astimezone(MYT) - slot > timedelta(days=6):
            continue                     # a slot from last week is stale, not a missed run
        done = any(r["workflow"] == name and r["trigger"].startswith("Schedule") and datetime.fromisoformat(r["started"]) >= slot for r in runs)
        if not done:
            out.append((method, (now_utc.astimezone(MYT) - slot) > timedelta(minutes=15)))
    return out


def tick(system, now_utc: datetime | None = None) -> list[str]:
    now = now_utc or datetime.now(timezone.utc)
    runs = system.store.runs(300)
    marks = [datetime.fromisoformat(r["started"]) for r in runs if r["workflow"] == "Scheduler" and r["note"] == "scheduler started"]
    if not marks:
        system.store.add_run("Scheduler", "Schedule", "Completed", "scheduler started")
        runs = system.store.runs(300)
        marks = [datetime.fromisoformat(r["started"]) for r in runs if r["workflow"] == "Scheduler" and r["note"] == "scheduler started"]
    fired = []
    for method, missed in due(now, runs, min(marks)):
        label = "Schedule · Mon 08:00 MYT" if method == "monday_check" else "Schedule · Mon 08:30 MYT"
        getattr(system, method)(trigger=label + (" (catch-up after downtime)" if missed else ""))
        fired.append(method)
    return fired


def start(system, every: float = 30.0) -> threading.Thread:
    def loop():
        while True:
            try:
                tick(system)
            except Exception as e:  # noqa: BLE001 - a failed run must not kill the schedule
                system.store.add_run("Scheduler", "Schedule", "Failed", f"{type(e).__name__}: {e}")
            time.sleep(every)
    t = threading.Thread(target=loop, daemon=True, name="crunchradar-scheduler")
    t.start()
    return t
