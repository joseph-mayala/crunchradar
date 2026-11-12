"""Run once with GEMINI_API_KEY set. Proves the live Gemini paths work, or says exactly how they fail.

  .venv/bin/python scripts/live_check.py
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from crunchradar.config import Settings  # noqa: E402
from crunchradar.store import Store  # noqa: E402
from crunchradar.workflows import System  # noqa: E402

s = Settings(db_path=str(Path(tempfile.mkdtemp()) / "live.db"))
if not s.gemini_key:
    sys.exit("No GEMINI_API_KEY. Put it in system/.env (gitignored) and run again.")
print(f"model: {s.gemini_model}")
sysm = System(s, Store(s.db_path))
brief = (s.data_dir / "briefs" / "a2.txt").read_text()
from crunchradar.brief_reader import read_brief  # noqa: E402
r = read_brief(brief, s)
print(f"\n1. Brief reader -> mode={r['mode']} {r['note']}")
for t in r["tasks"]:
    print(f"   {t['type']:<13} week {t['week']:<3} hours={t['hours']} {t['title'][:60]!r}")
res = sysm.monday_check(trigger="Manual · live check")
print(f"\n2. Monday agent -> mode={res['mode']} tools={res['tool_calls']}")
print(f"   requested approvals: {[x['move'] for x in res['requested']]}")
print(f"   summary: {res['summary']}")
print("\nIf mode is 'rules' above, Gemini was not used; the note says why.")
sys.exit(0 if r["mode"] == "gemini" and res["mode"] == "gemini" else 1)
