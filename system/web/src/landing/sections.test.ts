import { describe, expect, it } from "vitest";
import { SECTIONS, jumpTarget, pickActive } from "./sections";

const order = SECTIONS.map((s) => s.id);

describe("landing section nav", () => {
  it("has unique ids and plain labels with no dashes", () => {
    expect(new Set(order).size).toBe(order.length);
    for (const s of SECTIONS) expect(s.label).not.toMatch(/[\u2013\u2014]/);
  });

  it("picks the section with the highest ratio", () => {
    expect(pickActive(order, { "the-fix": 0.2, "monday-agent": 0.9 })).toBe("monday-agent");
  });

  it("breaks ties in page order and returns null when nothing is visible", () => {
    expect(pickActive(order, { safeguards: 1, "the-fix": 1 })).toBe("the-fix");
    expect(pickActive(order, {})).toBeNull();
    expect(pickActive(order, { "the-fix": 0 })).toBeNull();
  });

  it("jumpTarget subtracts the bar margin and clamps to the page", () => {
    expect(jumpTarget(500, 1000, 80, 99999)).toBe(1420);
    expect(jumpTarget(-2000, 100, 0, 99999)).toBe(0);
    expect(jumpTarget(5000, 0, 0, 3000)).toBe(3000);
  });
});
