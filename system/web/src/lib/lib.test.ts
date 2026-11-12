import { describe, expect, it } from "vitest";
import { band, crunchCount, fmtHours, heatLevel, niceMax, plural, scaleY, ticks, worstWeek } from "./chart";
import { extensionStatusTag, issueTag, mailKindLabel, modeBadge, proposalTag, runTag, verdictTag } from "./status";
import { expiryText, fmtDateTime, fmtShort, weekDate, weekOf, weekRange, weekStart } from "./weeks";
import { BASE_DEFAULT, computedLimit, estimate, loads } from "./model";
import { mockRequest } from "../mock";
import type { Overview } from "../types";

describe("chart scaling", () => {
  it("rounds the axis top above the peak and the limit", () => {
    expect(niceMax(48, 28)).toBe(55);
    expect(niceMax(12)).toBe(14);
    expect(niceMax(0)).toBe(10);
    expect(niceMax(80)).toBe(90);
  });
  it("makes even ticks from zero", () => {
    expect(ticks(55, 5)).toEqual([0, 11, 22, 33, 44, 55]);
    expect(ticks(0)).toEqual([0]);
  });
  it("maps values to y with clamping", () => {
    expect(scaleY(0, 50, 10, 110)).toBe(110);
    expect(scaleY(50, 50, 10, 110)).toBe(10);
    expect(scaleY(25, 50, 10, 110)).toBe(60);
    expect(scaleY(99, 50, 10, 110)).toBe(10);
    expect(scaleY(-5, 50, 10, 110)).toBe(110);
  });
  it("places bars inside their slot", () => {
    const b = band(0, 14, 0, 140, 0.4);
    expect(b.w).toBeCloseTo(6);
    expect(b.x).toBeCloseTo(2);
    expect(b.cx).toBeCloseTo(5);
    expect(band(13, 14, 0, 140, 0.4).cx).toBeCloseTo(135);
  });
  it("buckets heat relative to the limit", () => {
    expect(heatLevel(0, 28)).toBe(0);
    expect(heatLevel(2, 28)).toBe(1);
    expect(heatLevel(7, 28)).toBe(3);
    expect(heatLevel(10, 28)).toBe(4);
    expect(heatLevel(30, 28)).toBe(5);
  });
  it("counts crunch weeks and finds the worst", () => {
    expect(crunchCount([10, 30, 29, 28], 28)).toBe(2);
    expect(worstWeek([1, 5, 9, 9])).toBe(3);
    expect(worstWeek([])).toBe(0);
  });
  it("formats", () => {
    expect(plural(1, "crunch week")).toBe("1 crunch week");
    expect(plural(3, "crunch week")).toBe("3 crunch weeks");
    expect(fmtHours(48.25)).toBe("48.3");
    expect(fmtHours(28)).toBe("28");
  });
});

describe("status tags", () => {
  it("maps proposal statuses to brand tones", () => {
    expect(proposalTag("pending").tone).toBe("warn");
    expect(proposalTag("approved").tone).toBe("good");
    expect(proposalTag("rejected").tone).toBe("crit");
    expect(proposalTag("declined").tone).toBe("crit");
    expect(proposalTag("expired")).toEqual({ label: "Expired", tone: "mute" });
  });
  it("maps runs, modes, verdicts, issues", () => {
    expect(runTag("Needs review").tone).toBe("warn");
    expect(runTag("Completed").tone).toBe("good");
    expect(modeBadge("gemini")).toEqual({ label: "GEMINI", tone: "mute", brand: "gemini" });
    expect(modeBadge("rules")).toEqual({ label: "RULES", tone: "warn" });
    expect(modeBadge(null)).toBeNull();
    expect(verdictTag("refer").tone).toBe("warn");
    expect(extensionStatusTag("pending").tone).toBe("warn");
    expect(issueTag("crunch").tone).toBe("crit");
    expect(issueTag("hidden").tone).toBe("hol");
    expect(mailKindLabel("approval-request")).toBe("Approval request");
  });
});

describe("week and date helpers", () => {
  const start = "2027-01-04";
  it("finds the Monday of each week", () => {
    expect(weekDate(start, 1)).toBe("4 Jan");
    expect(weekDate(start, 11)).toBe("15 Mar");
    expect(weekStart(start, 2) - weekStart(start, 1)).toBe(7 * 86_400_000);
  });
  it("finds the week of a date, clamped", () => {
    expect(weekOf(start, Date.UTC(2027, 0, 10), 14)).toBe(1);
    expect(weekOf(start, Date.UTC(2027, 0, 11), 14)).toBe(2);
    expect(weekOf(start, Date.UTC(2026, 10, 12), 14)).toBe(1);
    expect(weekOf(start, Date.UTC(2027, 11, 1), 14)).toBe(14);
    expect(weekRange(3)).toEqual([1, 2, 3]);
  });
  it("formats timestamps in UTC", () => {
    expect(fmtDateTime("2026-11-15T07:10:00Z")).toBe("2026-11-15 07:10 UTC");
    expect(fmtDateTime("2026-11-15T07:10:00")).toBe("2026-11-15 07:10 UTC");
    expect(fmtShort("2026-11-15T07:10:00Z")).toBe("15 Nov 07:10");
    expect(fmtDateTime("not a date")).toBe("not a date");
  });
  it("describes expiry in plain words", () => {
    const now = Date.UTC(2026, 10, 12, 0, 0);
    expect(expiryText("2026-11-12T05:00:00Z", now)).toBe("expires in 5 h");
    expect(expiryText("2026-11-15T00:00:00Z", now)).toBe("expires in 3 days");
    expect(expiryText("2026-11-11T00:00:00Z", now)).toBe("expired");
    expect(expiryText(null, now)).toBe("no expiry");
  });
});

describe("estimate model and mock sample", () => {
  it("estimates a group report like the backend", () => {
    const e = estimate({ id: "b2", mod: "SWAT", title: "Architecture report", type: "report", weight: 30, words: 3000, group: true, due: 11 }, BASE_DEFAULT);
    expect(e.hours).toBe(22.1);
  });
  it("computes the MQA limit", () => {
    expect(computedLimit(21, 14, 20, 12)).toBe(28);
  });
  it("spreads big tasks over three weeks", () => {
    const { total } = loads([{ id: "x", mod: "M", title: "t", type: "code", weight: 40, words: 0, group: false, due: 5 }], 14, BASE_DEFAULT, ["M"]);
    expect(total.slice(2, 5)).toEqual([4.4, 6.6, 11]);
  });
  it("mock overview matches the agreed sample: peak 48, limit 28, 3 crunch weeks, W11 worst", async () => {
    const ov = (await mockRequest("GET", "/api/overview")) as Overview;
    expect(ov.limit).toBe(28);
    expect(Math.round(ov.peak)).toBe(48);
    expect(ov.crunch_weeks).toBe(3);
    expect(ov.hidden_tasks).toBe(2);
    expect(worstWeek(ov.weekly_hours)).toBe(11);
  });
});

describe("landing hero tiles", () => {
  it("maps the public summary to the four tiles", async () => {
    const { heroTiles } = await import("./landing");
    const t = heroTiles({ limit: 28, peak: 48.3, crunch_weeks: 3, hidden_tasks: 2, waiting_for_person: 1, weeks: 14, sample_data: true });
    expect(t.map((x) => `${x.value} ${x.small}`)).toEqual(["3 of 14", "48 h / 28 h", "2 in briefs", "1 decision"]);
    expect(t[0].state).toBe("bad");
    expect(t[1].state).toBe("bad");
  });
  it("marks a calm semester as ok and falls back when the call fails", async () => {
    const { heroTiles } = await import("./landing");
    const ok = heroTiles({ limit: 28, peak: 20, crunch_weeks: 0, hidden_tasks: 0, waiting_for_person: 0, weeks: 14, sample_data: true });
    expect(ok[0].state).toBe("ok");
    expect(ok[1].state).toBe("ok");
    expect(ok[3].small).toBe("decisions");
    const na = heroTiles(null);
    expect(na).toHaveLength(4);
    expect(na.every((x) => x.small === "not available" && x.value === "")).toBe(true);
  });
  it("mock public summary returns the agreed sample", async () => {
    const s = (await mockRequest("GET", "/api/public-summary")) as Record<string, unknown>;
    expect(s).toMatchObject({ limit: 28, peak: 48.3, crunch_weeks: 3, hidden_tasks: 2, waiting_for_person: 1, weeks: 14, sample_data: true });
  });
});

describe("weekly bars and heat ramp", () => {
  it("steps the heat grid through five indigo levels and never uses red", async () => {
    const { heatStep, heatColor, HEAT_RAMP } = await import("./chart");
    expect([0, 0.05, 2, 5, 9, 13, 16, 30].map(heatStep)).toEqual([0, 0, 1, 2, 3, 4, 5, 5]);
    expect(heatColor(0)).toBe(HEAT_RAMP[0]);
    expect(heatColor(20)).toBe("#8f94f5");
    expect(heatColor(13)).toBe("#7b84cf");
    for (const c of HEAT_RAMP) expect(c.toLowerCase()).not.toMatch(/f2606a|255,59,59|ff3b3b/);
  });
  it("hides value labels under 1 h", async () => {
    const { barValueLabel } = await import("./chart");
    expect(barValueLabel(0)).toBe("");
    expect(barValueLabel(0.9)).toBe("");
    expect(barValueLabel(1)).toBe("1");
    expect(barValueLabel(48.3)).toBe("48");
  });
  it("labels every week when wide and every second week when narrow", async () => {
    const { weekTick } = await import("./chart");
    expect(weekTick(10, false)).toBe("W11");
    expect(weekTick(0, true)).toBe("1");
    expect(weekTick(1, true)).toBe("");
    expect(weekTick(1, true, true)).toBe("2");
  });
  it("tops the axis at 1.35 x the limit or the peak, rounded up to 20", async () => {
    const { chartTop } = await import("./chart");
    expect(chartTop([48.3], 28)).toBe(60);
    expect(chartTop([10], 28)).toBe(40);
  });
});

describe("process tracker", () => {
  const p = (status: string) => ({ id: 1, assess_id: "x", mod: "M", title: "t", from_w: 1, to_w: 2, why: "", status, created: "", expires: null, decided: null, decided_by: null, followup: null, run_id: null }) as never;
  const m = (kind: string) => ({ id: 1, created: "", to_addr: "", cc: null, subject: "", body: "", kind, sent: false, error: null }) as never;
  it("marks done steps and the first open one as now", async () => {
    const { processSteps } = await import("./process");
    const s = processSteps({ crunchWeeks: 3, proposals: [p("pending")], outbox: [m("digest")] });
    expect(s.map((x) => x.state)).toEqual(["done", "done", "now", "todo"]);
    expect(s[0].hint).toBe("3 crunch weeks found");
  });
  it("starts at detect with no data and ends all done", async () => {
    const { processSteps } = await import("./process");
    expect(processSteps({ crunchWeeks: 0, proposals: [], outbox: [] }).map((x) => x.state)).toEqual(["now", "todo", "todo", "todo"]);
    expect(processSteps({ crunchWeeks: 1, proposals: [p("approved")], outbox: [m("reschedule")] }).every((x) => x.state === "done")).toBe(true);
  });
});

describe("brand marks", () => {
  it("every brand resolves to a non-empty logo src", async () => {
    const { BRANDS } = await import("../components/BrandMark");
    for (const [key, b] of Object.entries(BRANDS)) {
      expect(typeof b.src, key).toBe("string");
      expect(b.src.length, key).toBeGreaterThan(0);
      expect(b.name.length, key).toBeGreaterThan(0);
    }
  });
});

describe("week overlay helpers", () => {
  it("writes the date range in plain words", async () => {
    const { weekRangeLabel } = await import("./weekDetail");
    expect(weekRangeLabel("2027-03-15", "2027-03-21")).toBe("15 to 21 Mar");
    expect(weekRangeLabel("2027-02-28", "2027-03-06")).toBe("28 Feb to 6 Mar");
    expect(weekRangeLabel("", "")).toBe("");
  });
  it("says over or within the limit", async () => {
    const { limitLine } = await import("./weekDetail");
    expect(limitLine({ over: true, over_by: 20.3, limit: 28 })).toEqual({ text: "20.3 h over the 28 h limit", over: true });
    expect(limitLine({ over: false, over_by: 0, limit: 28 })).toEqual({ text: "within the 28 h limit", over: false });
  });
  it("notes holidays, festive weeks and the revision week", async () => {
    const { weekNotes } = await import("./weekDetail");
    expect(weekNotes({ holiday: null, festive_week: false, revision_week: false })).toEqual([]);
    expect(weekNotes({ holiday: "Chinese New Year", festive_week: true, revision_week: false })).toHaveLength(2);
    expect(weekNotes({ holiday: null, festive_week: false, revision_week: true })[0]).toMatch(/Revision week/);
  });
  it("module shares add up to the whole week, biggest first", async () => {
    const { moduleShares } = await import("./weekDetail");
    const s = moduleShares({ SWAT: 11.1, DSTR: 10.5, CCP: 9.8, IAC: 8.4, FWD: 5, RMCT: 3.7, X: 0 });
    expect(s.map((r) => r.mod)).toEqual(["SWAT", "DSTR", "CCP", "IAC", "FWD", "RMCT"]);
    expect(s.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
    expect(s.reduce((a, r) => a + r.hours, 0)).toBeCloseTo(48.5);
  });
  it("keeps previous and next inside the semester", async () => {
    const { stepWeek } = await import("./weekDetail");
    expect(stepWeek(1, -1, 14)).toBe(1);
    expect(stepWeek(14, 1, 14)).toBe(14);
    expect(stepWeek(11, 1, 14)).toBe(12);
  });
  it("closes a bottom sheet on a long pull or a flick", async () => {
    const { sheetShouldClose } = await import("./weekDetail");
    expect(sheetShouldClose(20, 100, 600)).toBe(false);
    expect(sheetShouldClose(200, 0, 600)).toBe(true);
    expect(sheetShouldClose(30, 900, 600)).toBe(true);
  });
  it("mock /api/week/11 follows the contract and adds up", async () => {
    const d = (await mockRequest("GET", "/api/week/11")) as import("../types").WeekDetail;
    expect(d.week).toBe(11);
    expect(d.starts).toBe("2027-03-15");
    expect(d.ends).toBe("2027-03-21");
    expect(d.over).toBe(true);
    expect(d.over_by).toBeCloseTo(d.hours - d.limit, 1);
    const sum = Object.values(d.modules).reduce((a, h) => a + h, 0);
    expect(sum).toBeCloseTo(d.hours, 0);
    expect(d.due.some((r) => r.hidden.length > 0)).toBe(true);
    expect(d.due.every((r) => r.due_week === 11)).toBe(true);
    expect(d.building.every((r) => r.due_week > 11)).toBe(true);
    await expect(mockRequest("GET", "/api/week/15")).rejects.toThrow();
  });
});
