"""A real schedule: Monday 08:00 crunch check and 08:30 follow-up, Malaysia time, with nobody logged in.

Runs inside `crunchradar serve` (SCHEDULER=1). On hosts that scale to zero (Cloud Run), leave this off and call the
POST /workflows/* endpoints from Cloud Scheduler with the CRON_KEY header instead.
"""
import threading
import time
from datetime import datetime, timedelta, timezone

MYT = timezone(timedelta(hours=8))
JOBS = [("monday_check", "Monday crunch check", 8, 0), ("follow_up", "Follow-up", 8, 30)]   # (method, run name, hour, minute) every Monday MYT


def due(now_utc: datetime, runs: list[dict]) -> list[str]:
    """Which jobs should fire now: it is Monday after their time in MYT and no scheduled run happened since today's slot."""
    now = now_utc.astimezone(MYT)
    if now.weekday() != 0:
        return []
    out = []
    for method, name, h, m in JOBS:
        slot = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if now < slot:
            continue
        done = any(r["workflow"] == name and r["trigger"].startswith("Schedule") and datetime.fromisoformat(r["started"]) >= slot for r in runs)
        if not done:
            out.append(method)
    return out


def tick(system, now_utc: datetime | None = None) -> list[str]:
    fired = due(now_utc or datetime.now(timezone.utc), system.store.runs(200))
    for method in fired:
        getattr(system, method)()
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
