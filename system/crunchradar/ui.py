"""The CrunchRadar screens, in the brand language from docs/BRAND.md. Plain server-rendered HTML, no build step."""
import html

LOGO = ('<svg viewBox="0 0 64 64" width="{s}" height="{s}" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M54.05 18.22 A26 26 0 1 0 54.05 45.78" stroke="#f5f5f6" stroke-width="5"/>'
        '<path d="M44.72 24.05 A15 15 0 1 0 44.72 39.95" stroke="#f5f5f6" stroke-opacity=".55" stroke-width="3.5"/><path d="M32 32 L57.43 26.59" stroke="#b3a1ff" stroke-width="4"/></g>'
        '<circle cx="32" cy="32" r="2.6" fill="#f5f5f6"/><circle cx="57.43" cy="26.59" r="4" fill="#c6f432"/></svg>')

CSS = """
:root{color-scheme:dark;--bg:#08070e;--ink:#f5f5f6;--ink2:#c9c9cf;--mute:#85858f;--line:rgba(255,255,255,.1);--lime:#c6f432;--lav:#b3a1ff;--red:#ff3b3b;--warn:#ffc65c;--hol:#7cd4ff}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--ink);font:15px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;padding:0 16px 48px;
 background:radial-gradient(760px 520px at -8% -10%,rgba(104,74,235,.35),transparent 62%),radial-gradient(640px 520px at 108% 55%,rgba(150,205,25,.14),transparent 62%),var(--bg);background-attachment:fixed}
.wrap{max-width:1100px;margin:0 auto}.narrow{max-width:560px}
h1,h2,h3{font-family:'Inter Tight',Inter,system-ui,sans-serif;letter-spacing:-.03em;margin:0}
.mono,.num{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}
header{display:flex;align-items:center;gap:12px;padding:22px 0}
header b{font:800 20px 'Inter Tight',Inter,sans-serif;letter-spacing:-.03em}
.pill{margin-left:auto;font:600 11px 'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:99px;color:var(--warn);border:1px solid rgba(255,198,92,.35);background:rgba(255,198,92,.08)}
.panel{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border:1px solid var(--line);border-radius:20px;padding:22px 24px;margin-bottom:18px}
.panel h2{font-size:19px;font-weight:700;margin-bottom:4px}.sub{color:var(--mute);font-size:13.5px;margin:0 0 14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:18px}
.tile{border:1px solid var(--line);border-radius:16px;padding:14px 18px;background:rgba(255,255,255,.04)}
.tile i{font:600 11px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);font-style:normal}
.tile b{display:block;font:800 34px 'Inter Tight',Inter,sans-serif;letter-spacing:-.03em;line-height:1.15}
.tile.bad b{color:var(--red)}.tile.ok b{color:var(--lime)}.tile.wait b{color:var(--warn)}
.tag{display:inline-block;font:700 10.5px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1px solid transparent;white-space:nowrap}
.t-ok{color:var(--lime);background:rgba(198,244,50,.1);border-color:rgba(198,244,50,.28)}
.t-wait{color:var(--warn);background:rgba(255,198,92,.1);border-color:rgba(255,198,92,.28)}
.t-bad{color:var(--red);background:rgba(255,59,59,.1);border-color:rgba(255,59,59,.28)}
.t-grey{color:var(--mute);background:rgba(255,255,255,.05);border-color:var(--line)}
.t-gem{color:var(--lav);background:rgba(179,161,255,.14);border-color:rgba(179,161,255,.4)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font:600 11px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink2)}td:first-child{color:var(--ink)}
.scroll{overflow-x:auto}
details{border-top:1px solid var(--line);padding:8px 0}details:first-of-type{border-top:0}
summary{cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--ink)}
pre{white-space:pre-wrap;word-break:break-word;margin:8px 0 0;padding:12px 14px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid var(--line);font:400 12.5px/1.5 'JetBrains Mono',monospace;color:var(--ink2)}
.btn{display:inline-block;border:1px solid rgba(255,255,255,.25);background:none;color:var(--ink);font:700 15px Inter,sans-serif;padding:11px 24px;border-radius:99px;cursor:pointer;text-decoration:none}
.btn.go{background:var(--lime);border-color:var(--lime);color:#10130a;box-shadow:0 0 28px -8px rgba(198,244,50,.6)}
.btn:hover{filter:brightness(1.08)}.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
:focus-visible{outline:2px solid var(--lime);outline-offset:2px}
.move{font:800 40px/1.1 'Inter Tight',Inter,sans-serif;letter-spacing:-.035em;margin:14px 0 8px}.move em{font-style:normal;color:var(--lime)}
.fine{color:var(--mute);font-size:13px}.guard{border-left:3px solid var(--lav);padding:10px 14px;background:rgba(179,161,255,.07);border-radius:0 12px 12px 0;color:var(--ink2);font-size:14px;margin-top:14px}
.chart{width:100%;height:auto;display:block}.chart text{fill:var(--mute);font:500 11px 'JetBrains Mono',monospace}
@media(max-width:560px){.move{font-size:30px}.panel{padding:18px 16px}}
"""


def esc(x) -> str:
    return html.escape(str(x))


def layout(title: str, body: str, narrow: bool = False, sample: bool = False) -> str:
    pill = '<span class="pill">Sample data</span>' if sample else ""
    return (f"<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>{esc(title)} · CrunchRadar</title>"
            "<link rel=icon href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%2308070e'/%3E%3Ccircle cx='32' cy='32' r='3' fill='%23c6f432'/%3E%3C/svg%3E\">"
            "<link rel=stylesheet href='https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap'>"
            f"<style>{CSS}</style></head><body><div class='wrap{' narrow' if narrow else ''}'><header>{LOGO.format(s=34)}<b>CrunchRadar</b>{pill}</header>{body}</div></body></html>")


def week_chart(hours: list[float], limit: float, holidays: dict) -> str:
    W, H, L, B, T = 1000, 260, 40, 34, 20
    ymax = -(-max(limit * 1.4, max(hours) * 1.12, 10) // 20) * 20   # round up to a multiple of 20 so ticks are clean
    n = len(hours)
    col = (W - L - 10) / n
    y = lambda v: T + (H - T - B) * (1 - v / ymax)
    out = [f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Assignment hours per week against the {limit:g} hour limit">']
    for k in range(5):
        v = ymax * k / 4
        out.append(f'<line x1="{L}" x2="{W - 10}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="rgba(255,255,255,.07)"/><text x="{L - 8}" y="{y(v) + 4:.1f}" text-anchor="end">{v:.0f}</text>')
    for i, v in enumerate(hours):
        x = L + i * col + col * 0.18
        w = col * 0.64
        over = v > limit
        out.append(f'<rect x="{x:.1f}" y="{y(v):.1f}" width="{w:.1f}" height="{max(y(0) - y(v), 1):.1f}" rx="4" fill="{"#ff3b3b" if over else "#b3a1ff"}" opacity="{1 if over else .8}"><title>Week {i + 1}: {v:.0f} h</title></rect>')
        if v > 0.5:
            out.append(f'<text x="{x + w / 2:.1f}" y="{y(v) - 6:.1f}" text-anchor="middle" style="fill:{"#ffd2d2" if over else "#c9c9cf"}">{v:.0f}</text>')
        hol = (i + 1) in holidays
        out.append(f'<text x="{x + w / 2:.1f}" y="{H - 12}" text-anchor="middle" style="fill:{"#7cd4ff" if hol else "#85858f"}">W{i + 1}{" ◆" if hol else ""}</text>')
    out.append(f'<line x1="{L}" x2="{W - 10}" y1="{y(limit):.1f}" y2="{y(limit):.1f}" stroke="#f5f5f6" stroke-dasharray="5 6" opacity=".6"/><text x="{W - 12}" y="{y(limit) - 6:.1f}" text-anchor="end" style="fill:#f5f5f6">limit {limit:g} h</text></svg>')
    return "".join(out)


def tag(status: str) -> str:
    s = (status or "").lower()
    cls = "t-ok" if s in ("completed", "approved", "confirmed") else "t-wait" if s in ("needs review", "pending", "running") else "t-bad" if s in ("rejected", "declined", "failed") else "t-grey"
    return f'<span class="tag {cls}">{esc(status)}</span>'


def dashboard(sm: dict, runs: list, proposals: list, outbox: list, holidays: dict, sample: bool) -> str:
    pend = [p for p in proposals if p["status"] == "pending"]
    tiles = (f'<div class="tile {"bad" if sm["crunch_weeks"] else "ok"}"><i>Crunch weeks</i><b>{sm["crunch_weeks"]}</b></div>'
             f'<div class="tile {"bad" if sm["peak"] > sm["limit"] else "ok"}"><i>Peak week</i><b>{sm["peak"]:.0f} h <span class="fine">/ {sm["limit"]:g} h</span></b></div>'
             f'<div class="tile"><i>Hidden tasks found</i><b>{sm["hidden_tasks"]}</b></div>'
             f'<div class="tile {"wait" if pend else ""}"><i>Waiting for a person</i><b>{len(pend)}</b></div>')
    sens = " · ".join(f"{k:g} h → {v} crunch week{'s' if v != 1 else ''}" for k, v in sm["sensitivity"].items())
    prow = "".join(f"<tr><td>{esc(p['mod'])} {esc(p['title'])}</td><td class=mono>W{p['from_w']} → W{p['to_w']}</td><td>{tag(p['status'])}</td><td>{esc(p['why'])}</td></tr>" for p in proposals[::-1][:8]) or '<tr><td colspan=4 class=fine>No proposals yet. Run the Monday check.</td></tr>'
    rrow = ""
    for r in runs[:10]:
        mode = "gemini" if "Agent: gemini" in (r["note"] or "") else "rules" if "Agent: rules" in (r["note"] or "") else ""
        badge = f' <span class="tag {"t-gem" if mode == "gemini" else "t-wait"}">{mode}</span>' if mode else ""
        rrow += f"<tr><td>{esc(r['workflow'])}{badge}</td><td class=mono>{esc(r['started'][5:16].replace('T', ' '))}</td><td>{tag(r['status'])}</td><td>{esc(r['trigger'])}</td><td>{esc(r['note'])}</td></tr>"
    rrow = rrow or '<tr><td colspan=5 class=fine>No runs yet.</td></tr>'
    mails = "".join(f"<details><summary>{tag(m['kind'])} <b>{esc(m['subject'])}</b> <span class=fine>to {esc(m['to_addr'])} · {'sent' if m['sent'] else 'outbox only'}</span></summary><pre>{esc(m['body'])}</pre></details>" for m in outbox[:8]) or '<p class=fine>No email yet.</p>'
    return layout("Dashboard", f'''
<div class="tiles">{tiles}</div>
<div class="panel"><h2>Weekly assignment load</h2><p class="sub">Estimated hours per week for the whole cohort. Above the line is a crunch week. Limit = MQA 40 h per credit, minus two team assumptions.</p>{week_chart(sm["weekly_hours"], sm["limit"], holidays)}<p class="fine" style="margin:8px 0 0">At other limits: {esc(sens)}</p></div>
<div class="panel"><h2>Moves waiting for a decision</h2><p class="sub">Nothing changes until a named person approves. Links are single-use and expire.</p><div class="scroll"><table><tr><th>Move</th><th>Weeks</th><th>Status</th><th>Why</th></tr>{prow}</table></div></div>
<div class="panel"><h2>Run history</h2><p class="sub">Every automated run, what started it, and which planner ran. The rules planner is never hidden.</p><div class="scroll"><table><tr><th>Workflow</th><th>When</th><th>Status</th><th>Trigger</th><th>Note</th></tr>{rrow}</table></div></div>
<div class="panel"><h2>Email</h2><p class="sub">Everything the system sent or drafted. Without SMTP settings these stay in this outbox.</p>{mails}</div>''', sample=sample)


def decision_page(p: dict, before: float | None, after: float | None, expires: str) -> str:
    effect = f'<p class="fine">Peak week: <span class="mono">{before:.0f} h → {after:.0f} h</span></p>' if before is not None and after is not None else ""
    return layout("Approve a deadline move", f'''<div class="panel"><span class="tag t-wait">Needs your decision</span>
<div class="move">{esc(p["mod"])} {esc(p["title"])}<br><em>Week {p["from_w"]} → Week {p["to_w"]}</em></div>
<p style="color:var(--ink2);margin:0 0 6px">{esc(p["why"])}</p>{effect}
<div class="guard">Nothing changes until you choose. Approving emails the lecturer. Rejecting sends nothing.</div>
<form method="post" class="btns"><button class="btn go" name="decision" value="approve">Approve</button><button class="btn" name="decision" value="reject">Reject</button></form>
<p class="fine" style="margin-top:14px">This link works once and expires {esc(expires)}.</p></div>''', narrow=True)


def message_page(title: str, message: str, kind: str = "ok") -> str:
    t = {"ok": "t-ok", "bad": "t-bad", "grey": "t-grey"}.get(kind, "t-grey")
    return layout(title, f'<div class="panel"><span class="tag {t}">{esc(title)}</span><div class="move" style="font-size:28px">{esc(message)}</div></div>', narrow=True)


def decline_page(p: dict) -> str:
    return layout("Decline a move", f'''<div class="panel"><span class="tag t-wait">Lecturer reply</span>
<div class="move" style="font-size:30px">{esc(p["mod"])} {esc(p["title"])}<br><em>Week {p["to_w"]} not possible?</em></div>
<p style="color:var(--ink2)">The move is undone, the deadline stays in Week {p["from_w"]}, and the programme leader gets the next option.</p>
<form method="post" class="btns"><button class="btn go">Yes, this date is not possible</button></form></div>''', narrow=True)
