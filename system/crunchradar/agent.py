"""The Monday agent: Gemini decides which tools to call and writes the explanation; the rules decide what is allowed.

Tools the model can call (all backed by the rules engine, none can change a deadline):
  get_overview()                         weekly hours, issues, hidden tasks
  get_options()                          the moves the rules allow (it cannot invent others)
  request_approval(option, explanation)  sends one allowed move to the programme leader for approval
  escalate(reason)                       asks for a bigger decision when no safe move exists
  finish(summary)                        ends the run
With no key, or if Gemini fails or is too slow, a deterministic planner does the same steps, so the run never breaks.
"""
import json
import time
import urllib.error
import urllib.request

from . import rules

MAX_TURNS = 6
BUDGET_SECONDS = 45   # whole Gemini run; after this the rules planner takes over
MAX_APPROVALS = 3

TOOLS = [{"functionDeclarations": [
    {"name": "get_overview", "description": "Weekly assignment hours for the cohort, the weekly limit, and the issues found (crunch weeks, hidden tasks, festive-week clashes, feedback gaps)."},
    {"name": "get_options", "description": "The deadline moves the rules allow. Only these can be proposed."},
    {"name": "request_approval", "description": "Send ONE allowed move to the programme leader for approval. Nothing changes until a human approves.",
     "parameters": {"type": "OBJECT", "properties": {"option": {"type": "INTEGER", "description": "index from get_options"}, "explanation": {"type": "STRING", "description": "1-2 plain sentences for the programme leader: which week is overloaded and what the move changes"}}, "required": ["option", "explanation"]}},
    {"name": "escalate", "description": "Ask the programme leader for a bigger decision when crunch weeks remain but no allowed move helps.",
     "parameters": {"type": "OBJECT", "properties": {"reason": {"type": "STRING"}}, "required": ["reason"]}},
    {"name": "finish", "description": "End the run with a one-sentence summary.", "parameters": {"type": "OBJECT", "properties": {"summary": {"type": "STRING"}}, "required": ["summary"]}},
]}]

SYSTEM = ("You are CrunchRadar, a workflow agent for a university programme leader. Check the cohort's weekly assignment hours against the limit. "
          "Call get_overview, then get_options. If options exist, call request_approval for the best one or two (never more than three), with a short plain explanation. "
          "If crunch weeks exist but there are no options, call escalate. Then call finish. You can only propose moves that get_options returned. Never claim a deadline has changed: a human approves every change.")


class Agent:
    def __init__(self, system, run_id, plan, options, llm_post=None):
        self.sys, self.run_id, self.plan, self.options = system, run_id, plan, options
        self.s = system.s
        self.llm_post = llm_post or self._post
        self.requested, self.calls, self.summary_text, self.mode, self.model_used = [], [], "", "rules", ""

    # ----- tool implementations (the rules are in charge) -----
    def _overview(self):
        tot = rules.loads(self.plan, self.s.weeks, self.sys.base)
        return {"limit_hours": self.s.limit, "weekly_hours": {f"W{w}": round(tot[w], 1) for w in range(1, self.s.weeks + 1)}, "issues": [i["text"] for i in rules.issues(self.plan, self.s, self.sys.base)]}

    def _options(self):
        return [{"option": i, "move": f"{o['mod']} {o['title']}: Week {o['from']} to Week {o['to']}", "peak_before": round(max(o["before"]), 1), "peak_after": round(max(o["after"]), 1),
                 "from_holiday_week": o["from_holiday"]} for i, o in enumerate(self.options)]

    def _request(self, option, explanation):
        if not isinstance(option, int) or not 0 <= option < len(self.options):
            return {"error": "option is not one the rules allow"}
        if len(self.requested) >= MAX_APPROVALS:
            return {"error": "approval limit for one run reached"}
        o = self.options[option]
        text = (str(explanation).strip() or self._default_why(o))[:400]
        p = self.sys.request_approval(self.run_id, o, text)
        if not p:
            return {"note": "already waiting for approval"}
        self.requested.append({"proposal": p["id"], "move": f"{o['mod']} {o['title']} W{o['from']}→W{o['to']}"})
        return {"ok": True, "sent_to": "programme leader", "status": "waiting for human approval"}

    def _default_why(self, o):
        w = max(range(1, self.s.weeks + 1), key=lambda k: o["before"][k] - o["after"][k])
        bits = [f"Week {w} drops from about {round(o['before'][w])} h to {round(o['after'][w])} h of assignment work (limit {self.s.limit:g} h)."]
        if o["from_holiday"]:
            bits.insert(0, f"Takes the deadline out of {self.s.holidays.get(o['from'], 'a festive')} week.")
        return " ".join(bits)

    def _call(self, name, args):
        self.calls.append(name)
        if name == "get_overview":
            return self._overview()
        if name == "get_options":
            return {"options": self._options()}
        if name == "request_approval":
            return self._request(args.get("option"), args.get("explanation", ""))
        if name == "escalate":
            self.sys.escalate(str(args.get("reason", "No safe move found."))[:600])
            return {"ok": True}
        if name == "finish":
            self.summary_text = str(args.get("summary", ""))[:300]
            return {"ok": True}
        return {"error": "unknown tool"}

    # ----- Gemini transport -----
    def _post(self, payload):
        from .gemini_client import generate
        data = generate(payload, self.s, max(self.s.gemini_timeout, 15))
        self.model_used = data.get("_model", self.s.gemini_model)
        return data

    def _run_gemini(self):
        contents = [{"role": "user", "parts": [{"text": "Run the Monday check now."}]}]
        start = time.monotonic()
        for _ in range(MAX_TURNS):
            if time.monotonic() - start > BUDGET_SECONDS:
                raise TimeoutError("agent time budget used")
            resp = self.llm_post({"systemInstruction": {"parts": [{"text": SYSTEM}]}, "contents": contents, "tools": TOOLS, "toolConfig": {"functionCallingConfig": {"mode": "AUTO"}}, "generationConfig": {"temperature": 0.2}})
            parts = resp["candidates"][0]["content"].get("parts", [])
            calls = [p["functionCall"] for p in parts if "functionCall" in p]
            if not calls:
                self.summary_text = self.summary_text or "".join(p.get("text", "") for p in parts)[:300]
                return
            contents.append({"role": "model", "parts": parts})
            contents.append({"role": "user", "parts": [{"functionResponse": {"name": c["name"], "response": {"result": self._call(c["name"], c.get("args") or {})}}} for c in calls]})
            if "finish" in self.calls:
                return

    def _run_rules(self):
        self._call("get_overview", {})
        if self.options:
            for i in range(min(2, len(self.options))):
                self._call("request_approval", {"option": i, "explanation": ""})
        elif any(v > self.s.limit for v in rules.loads(self.plan, self.s.weeks, self.sys.base)[1:]):
            self._call("escalate", {"reason": "Crunch weeks remain and no allowed move helps."})
        self._call("finish", {"summary": "Checked the week-by-week load with the rules."})

    def run(self):
        if self.s.gemini_key or self.llm_post != self._post:
            try:
                self._run_gemini()
                self.mode = "gemini"
                if not self.calls:
                    raise ValueError("model made no tool calls")
            except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, OSError, json.JSONDecodeError) as e:
                prefix = f"(Gemini unavailable: {type(e).__name__}; rules planner used) "
                self.mode = "rules"
                if not self.requested:   # do not repeat work the model already finished
                    self._run_rules()
                self.summary_text = prefix + self.summary_text
        else:
            self._run_rules()
        return {"requested": self.requested, "mode": self.mode, "model": self.model_used, "tool_calls": self.calls, "summary": self.summary_text}
