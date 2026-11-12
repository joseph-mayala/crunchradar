/**
 * The workload estimate, ported from the prototype / backend rules.py.
 * Used only by the mock layer so the sample numbers react to the assumptions panel.
 */
import type { BaseHours, TaskType } from "../types";

export interface PlanItem {
  id: string;
  mod: string;
  title: string;
  type: TaskType;
  weight: number;
  words: number;
  group: boolean;
  due: number;
  fixed?: boolean;
  hidden?: string;
  parent?: string;
  feedback?: number;
}

export const BASE_DEFAULT: BaseHours = { code: 12, report: 8, presentation: 5, test: 6, quiz: 1.5, logbook: 2 };
export const TYPE_LABEL: Record<TaskType, string> = {
  code: "Coding",
  report: "Report",
  presentation: "Presentation",
  test: "Test",
  quiz: "Quiz",
  logbook: "Lab logbook",
};

const r1 = (x: number) => Math.round(x * 10) / 10;

export function estimate(a: PlanItem, base: BaseHours): { hours: number; parts: string[] } {
  const parts: string[] = [];
  let h = base[a.type];
  parts.push(`${TYPE_LABEL[a.type]} base ${base[a.type]} h`);
  if (a.words) {
    const w = a.words / 300;
    h += w;
    parts.push(`${a.words.toLocaleString("en")} words +${w.toFixed(1)} h`);
  }
  if (a.weight) {
    const w = a.weight * 0.25;
    h += w;
    parts.push(`${a.weight}% weighting +${w.toFixed(1)} h`);
  }
  if (a.group) {
    h = h * 0.75 + 3;
    parts.push("group: x0.75 shared, +3 h coordination");
  }
  return { hours: r1(h), parts };
}

export function spread(a: PlanItem, base: BaseHours): Record<number, number> {
  const h = estimate(a, base).hours;
  const shares = h >= 15 ? [0.2, 0.3, 0.5] : h >= 7 ? [0.35, 0.65] : [1];
  const out: Record<number, number> = {};
  shares.forEach((s, i) => {
    const w = a.due - (shares.length - 1 - i);
    if (w >= 1) out[w] = (out[w] ?? 0) + h * s;
  });
  return out;
}

/** Weekly totals (index 0 = week 1) and per-module rows. */
export function loads(items: PlanItem[], weeks: number, base: BaseHours, modules: string[]) {
  const total = Array<number>(weeks).fill(0);
  const byMod: Record<string, number[]> = {};
  modules.forEach((m) => (byMod[m] = Array<number>(weeks).fill(0)));
  for (const a of items) {
    for (const [w, h] of Object.entries(spread(a, base))) {
      const i = Number(w) - 1;
      if (i < 0 || i >= weeks) continue;
      total[i] += h;
      (byMod[a.mod] ??= Array<number>(weeks).fill(0))[i] += h;
    }
  }
  return { total: total.map(r1), byMod: Object.fromEntries(Object.entries(byMod).map(([k, v]) => [k, v.map(r1)])) };
}

/** MQA: 1 credit = 40 notional hours, spread over the teaching weeks, minus two team assumptions. */
export function computedLimit(credits: number, weeks: number, classes: number, revision: number): number {
  return Math.round((credits * 40) / weeks - classes - revision);
}
