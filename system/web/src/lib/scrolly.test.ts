import { describe, expect, it } from "vitest";
import { RELIEF, activeMove, chartAt, countAt, fixAt, hoursText, lineAt, moveWindow, numberWord, overCount, peakWeek, riseAt, seg, settleAt, stepAt } from "./scrolly";
import { mockRequest } from "../mock";
import type { PublicSummary } from "../types";

const BEFORE = [0, 0, 6.2, 8.4, 13.9, 16.3, 32.6, 14.9, 22.5, 34.8, 48.3, 13.6, 0, 0];
const AFTER = [0, 0, 6.2, 8.4, 8.5, 8.2, 24.4, 23.0, 27.5, 21.9, 31.8, 23.4, 28.3, 0];

describe("scroll progress to the relief chart", () => {
  it("clamps windows", () => {
    expect(seg(-1, 0, 1)).toBe(0);
    expect(seg(0.5, 0, 1)).toBe(0.5);
    expect(seg(3, 0, 1)).toBe(1);
  });
  it("starts empty and rises week by week", () => {
    expect(chartAt(0, BEFORE, AFTER, 4).every((h) => h === 0)).toBe(true);
    const mid = RELIEF.A_END * 0.5;
    expect(riseAt(mid, 0, 14)).toBeGreaterThan(riseAt(mid, 13, 14));
    expect(riseAt(RELIEF.A_END, 13, 14)).toBe(1);
  });
  it("shows exactly today's hours at the end of phase A", () => {
    expect(chartAt(RELIEF.A_END + 0.01, BEFORE, AFTER, 4)).toEqual(BEFORE);
  });
  it("lands exactly on the after shape once every move has played", () => {
    const end = chartAt(1, BEFORE, AFTER, 4);
    end.forEach((h, i) => expect(h).toBeCloseTo(AFTER[i], 6));
    expect(fixAt(RELIEF.B_END, 4)).toBe(1);
  });
  it("applies the fix one move at a time, and holds between moves", () => {
    const [, b0] = moveWindow(0, 4);
    expect(fixAt(b0 - 0.001, 4)).toBeCloseTo(0.25, 6);
    expect(fixAt(moveWindow(1, 4)[1] - 0.001, 4)).toBeCloseTo(0.5, 6);
    expect(fixAt(RELIEF.B_START - 0.01, 4)).toBe(0);
  });
  it("keeps the before shape when there is no after data", () => {
    expect(chartAt(1, BEFORE, null, 0)).toEqual(BEFORE);
  });
  it("names the active move and the loop step", () => {
    expect(activeMove(0.1, 4)).toBe(-1);
    expect(activeMove(RELIEF.B_START, 4)).toBe(0);
    expect(activeMove(0.95, 4)).toBe(4);
    expect(stepAt(0.1, 4)).toBe(0);
    expect(stepAt(RELIEF.B_START + 0.001, 4)).toBe(1);
    expect(stepAt(moveWindow(0, 4)[1] - 0.001, 4)).toBe(2);
    expect(stepAt(0.99, 4)).toBe(3);
  });
});

describe("counting between real numbers", () => {
  it("interpolates and rounds", () => {
    expect(countAt(48.3, 31.8, 0, 1)).toBe(48.3);
    expect(countAt(48.3, 31.8, 1, 1)).toBe(31.8);
    expect(countAt(48.3, 31.8, 0.5, 1)).toBe(40.1);
    expect(countAt(3, 2, 0.4)).toBe(3);
    expect(countAt(3, 2, 0.6)).toBe(2);
    expect(countAt(3, 2, 5)).toBe(2);
  });
  it("finds the peak week and the over-limit count", () => {
    expect(peakWeek(BEFORE)).toEqual({ week: 11, hours: 48.3 });
    expect(peakWeek([])).toBeNull();
    expect(overCount(BEFORE, 28)).toBe(3);
    expect(overCount(AFTER, 28)).toBe(2);
  });
  it("writes words and hours plainly", () => {
    expect(numberWord(4)).toBe("Four");
    expect(numberWord(12)).toBe("12");
    expect(hoursText(48.3)).toBe("48.3");
    expect(hoursText(28)).toBe("28");
  });
});

describe("log lines and pan settle", () => {
  it("brings log lines in order and keeps them", () => {
    expect(lineAt(0, 0, 5)).toBe(0);
    expect(lineAt(1, 4, 5)).toBe(1);
    expect(lineAt(0.3, 0, 5)).toBeGreaterThan(lineAt(0.3, 4, 5));
  });
  it("has the first pan card settled from the start", () => {
    expect(settleAt(0, 0, 6)).toBe(1);
    expect(settleAt(0, 3, 6)).toBe(0);
    expect(settleAt(1, 5, 6)).toBe(1);
  });
});

describe("mock public summary", () => {
  it("carries the before and after data from the live backend", async () => {
    const s = (await mockRequest("GET", "/api/public-summary")) as PublicSummary;
    expect(s.weekly_hours).toEqual(BEFORE);
    expect(s.weekly_hours_after).toEqual(AFTER);
    expect(s.peak_after).toBe(31.8);
    expect(s.crunch_weeks_after).toBe(2);
    expect(s.illustrated_moves?.map((m) => `${m.mod} ${m.from}-${m.to}`)).toEqual(["SWAT 11-13", "DSTR 11-13", "RMCT 7-9", "RMCT 12-13"]);
    expect(Math.max(...(s.weekly_hours ?? []))).toBe(s.peak);
  });
});
