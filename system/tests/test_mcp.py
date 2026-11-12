import anyio

from crunchradar.mcp_server import build_server


def run(coro):
    return anyio.run(lambda: coro)


def test_mcp_exposes_only_safe_tools(sysm):
    server = build_server(sysm)
    names = {t.name for t in anyio.run(server.list_tools)}
    assert names == {"weekly_summary", "list_allowed_moves", "request_approval", "check_draft_assignment"}
    assert not any("move_deadline" in n or "approve" == n for n in names)        # nothing can change a deadline


def test_mcp_tool_calls_work_and_need_a_human(sysm):
    server = build_server(sysm)

    async def go():
        moves = await server.call_tool("list_allowed_moves", {})
        await server.call_tool("request_approval", {"option": 0, "explanation": "Week 11 is overloaded."})
        bad = await server.call_tool("request_approval", {"option": 99, "explanation": "invented"})
        return moves, bad

    moves, bad = anyio.run(go)
    assert moves and "error" in str(bad)
    assert sysm.store.proposals("pending") and not sysm.store.proposals("approved")   # waiting for a person
