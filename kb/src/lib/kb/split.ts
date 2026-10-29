// Splits a merged ticket into the problems its reports describe. Cause comes from causes.ts (tenant +
// way in); a report the desk read as a one-day move (desk-notes.json) is its own problem, whatever
// its tenant: a day/month swap never moves a date by one day.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';
const INTAKE_TAGS: readonly Problem[] = ['parser', 'hint'];

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'one-day';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = { problem: Problem; reports: Report[]; tenants: number; firstSeen: string; lastSeen: string; mistagged: number };

export function splitTicket(all: Report[], ticket: number, tenantOf: (r: Report) => Tenant | undefined, oneDayMove: readonly string[]) {
  const merged = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const groups: ProblemGroup[] = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        // Intake tags only `parser` or `hint`. Count a tag as wrong only where intake had the right tag to give.
        mistagged: rs.filter((r) => INTAKE_TAGS.includes(problem) && r.meta.intakeTag !== problem).length,
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { rows: all.length, merged, groups };
}
