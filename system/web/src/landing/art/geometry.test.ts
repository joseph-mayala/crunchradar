import { describe, expect, it } from "vitest";
import { arcPath, polar, radarDots, skylinePath, wedgePath, weekAngle } from "./geometry";

describe("landing art geometry", () => {
  it("polar puts 0 degrees straight up and runs clockwise", () => {
    expect(polar(0, 0, 10, 0)).toEqual({ x: 0, y: -10 });
    expect(polar(0, 0, 10, 90)).toEqual({ x: 10, y: 0 });
    expect(polar(5, 5, 10, 180)).toEqual({ x: 5, y: 15 });
  });

  it("weekAngle centres each week in its slice", () => {
    expect(weekAngle(1, 4)).toBe(45);
    expect(weekAngle(4, 4)).toBe(315);
    expect(weekAngle(1, 0)).toBe(0);
  });

  it("radarDots marks weeks over the limit and the single peak", () => {
    const dots = radarDots([10, 40, 30], 28, 100);
    expect(dots.map((d) => d.over)).toEqual([false, true, true]);
    expect(dots.filter((d) => d.peak).map((d) => d.week)).toEqual([2]);
    // the peak sits on the outer radius when no top is given
    expect(Math.hypot(dots[1].x, dots[1].y)).toBeCloseTo(100, 1);
    expect(radarDots([], 28, 100)).toEqual([]);
  });

  it("skylinePath draws one closed bar per week and nothing for no data", () => {
    const d = skylinePath([1, 2], 100, 50);
    expect(d.match(/Z/g)?.length).toBe(2);
    expect(d).toContain("V0"); // the tallest bar reaches the top
    expect(skylinePath([], 100, 50)).toBe("");
    expect(skylinePath([1], 0, 50)).toBe("");
  });

  it("arcPath picks the large-arc flag past half way and is empty at zero", () => {
    expect(arcPath(0, 0, 10, 0)).toBe("");
    expect(arcPath(0, 0, 10, 0.25)).toContain(" 0 0 1 ");
    expect(arcPath(0, 0, 10, 0.75)).toContain(" 0 1 1 ");
  });

  it("wedgePath starts at the centre", () => {
    expect(wedgePath(10, 30).startsWith("M0 0L0 -10")).toBe(true);
  });
});
