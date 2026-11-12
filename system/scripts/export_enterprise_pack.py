"""Write enterprise/ : everything to paste into a Gemini Enterprise agent when access arrives.

  .venv/bin/python scripts/export_enterprise_pack.py
"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import anyio  # noqa: E402

from crunchradar.agent import SYSTEM  # noqa: E402
from crunchradar.api import create_app  # noqa: E402
from crunchradar.config import Settings  # noqa: E402
from crunchradar.mcp_server import build_server  # noqa: E402
from crunchradar.store import Store  # noqa: E402
from crunchradar.workflows import System  # noqa: E402

out = Path(__file__).resolve().parent.parent / "enterprise"
out.mkdir(exist_ok=True)
s = Settings(db_path=str(Path(tempfile.mkdtemp()) / "x.db"), gemini_key="")
sysm = System(s, Store(s.db_path))
(out / "openapi.json").write_text(json.dumps(create_app(sysm).openapi(), indent=2))
(out / "agent_instructions.md").write_text(
    "# Agent instructions (paste into the Gemini Enterprise agent)\n\n" + SYSTEM + "\n\n"
    "## Workflows to create\n\n"
    "1. **Monday crunch check**: trigger Monday 08:00 Malaysia time. Steps: call `weekly_summary`; if any week is over the limit call `list_allowed_moves`; call `request_approval` for the best one or two; stop.\n"
    "2. **Follow-up**: trigger Monday 08:30. Call `POST /workflows/follow-up`.\n"
    "3. **Pre-publish check**: manual `@CrunchRadar` with a draft brief. Call `check_draft_assignment`.\n"
    "4. **Approval**: a human-in-the-loop Approval step before any email goes out. The system's own approval link can be used if the built-in step is not available.\n")
tools = anyio.run(build_server(sysm).list_tools)
(out / "mcp_tools.json").write_text(json.dumps([{"name": t.name, "description": t.description, "inputSchema": t.input_schema if hasattr(t, "input_schema") else getattr(t, "inputSchema", None)} for t in tools], indent=2, default=str))
print("wrote", *sorted(p.name for p in out.iterdir()))
