"""CrunchRadar as MCP tools. Any MCP-capable agent (including one built in Gemini Enterprise) can call the rules without re-implementing them.

There is deliberately no tool that changes a deadline. The only write is request_approval, which emails a named human.
Run:  python -m crunchradar mcp            (stdio)      |      python -m crunchradar mcp --http 8001
"""
from mcp.server.mcpserver import MCPServer

from . import rules
from .workflows import System


def build_server(system: System | None = None) -> MCPServer:
    sysm = system or System()
    server = MCPServer(
        "crunchradar",
        instructions=("Tools for finding assignment crunch weeks and proposing deadline moves. The rules decide what is allowed; a human approves every change. "
                      "Call weekly_summary, then list_allowed_moves, then request_approval for the best option. Never claim a deadline has changed."))

    @server.tool()
    def weekly_summary() -> dict:
        """Weekly assignment hours for the cohort, the weekly limit, hidden tasks found in briefs, issues, and how many crunch weeks exist at other limits."""
        return sysm.summary()

    @server.tool()
    def list_allowed_moves() -> list[dict]:
        """The deadline moves the rules allow right now (1-2 weeks later, never earlier, never fixed tests, never festive or revision weeks). Only these can be proposed."""
        plan = sysm.load_plan()["plan"]
        opts = rules.suggestions(plan, sysm.s, sysm.store.rejected_keys())
        return [{"option": i, "move": f"{o['mod']} {o['title']}: Week {o['from']} to Week {o['to']}", "peak_before_h": round(max(o["before"]), 1),
                 "peak_after_h": round(max(o["after"]), 1), "from_festive_week": o["from_holiday"]} for i, o in enumerate(opts)]

    @server.tool()
    def request_approval(option: int, explanation: str) -> dict:
        """Send ONE allowed move (an index from list_allowed_moves) to the programme leader for approval. Nothing changes until that person approves via a single-use, expiring link."""
        plan = sysm.load_plan()["plan"]
        opts = rules.suggestions(plan, sysm.s, sysm.store.rejected_keys())
        if not 0 <= option < len(opts):
            return {"error": "option is not one the rules allow"}
        run_id = sysm.store.add_run("Monday crunch check", "Tool call · MCP", "Needs review", "approval requested through an MCP tool call")
        p = sysm.request_approval(run_id, opts[option], (explanation or "").strip()[:400] or "Reduces the overloaded week.")
        return {"status": "waiting for human approval"} if p else {"status": "already waiting for approval"}

    @server.tool()
    def check_draft_assignment(mod: str, type: str, due: int, weight: float = 0, words: int = 0, group: bool = False, title: str = "New assignment") -> dict:
        """Before a lecturer publishes a deadline: would it push a week over the limit, and which nearby weeks are lightest?"""
        return sysm.pre_publish({"mod": mod, "type": type, "due": due, "weight": weight, "words": words, "group": group, "title": title})

    return server


def main(argv: list[str] | None = None) -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", type=int, default=0, help="serve over streamable HTTP on this port instead of stdio")
    a = ap.parse_args(argv)
    server = build_server()
    if a.http:
        import anyio
        anyio.run(server.run_streamable_http_async)
    else:
        server.run("stdio")


if __name__ == "__main__":
    main()
