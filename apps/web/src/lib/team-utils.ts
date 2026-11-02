import type { TeamMember } from "@/lib/content";

/** Groups people by level (1 is the top), keeping the order staff chose inside each level. */
export function groupByLevel(members: TeamMember[]): TeamMember[][] {
  const levels = [...new Set(members.map((m) => m.level))].sort(
    (a, b) => a - b,
  );
  return levels.map((l) => members.filter((m) => m.level === l));
}
