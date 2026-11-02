import { describe, expect, it } from "vitest";
import type { TeamMember } from "./content";
import { groupByLevel } from "./team-utils";

const m = (id: string, level: number): TeamMember => ({
  id,
  full_name: id,
  role_title: "Role",
  bio: null,
  photo_path: null,
  level,
  sort_order: 10,
  published: true,
});

describe("groupByLevel", () => {
  it("returns tiers from the top level down, keeping order inside a tier", () => {
    const tiers = groupByLevel([m("c", 3), m("a", 1), m("b2", 2), m("b1", 2)]);
    expect(tiers.map((t) => t.map((x) => x.id))).toEqual([
      ["a"],
      ["b2", "b1"],
      ["c"],
    ]);
  });
  it("copes with nobody", () => {
    expect(groupByLevel([])).toEqual([]);
  });
});
