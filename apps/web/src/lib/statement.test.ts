import { describe, expect, it } from "vitest";
import { buildStatement, type StatementInput } from "./statement";

const e = (over: Partial<StatementInput>): StatementInput => ({
  id: "x",
  reversesId: null,
  createdAt: "2026-11-01T08:00:00Z",
  type: "savings_contribution",
  amount: "5.00",
  savingsDelta: "5.00",
  feeDelta: "0.00",
  currency: "USD",
  ...over,
});

describe("buildStatement", () => {
  it("keeps a running savings balance in date order", () => {
    const s = buildStatement(
      [
        e({ id: "b", createdAt: "2026-11-08T08:00:00Z", savingsDelta: "10.00" }),
        e({ id: "a", createdAt: "2026-11-01T08:00:00Z", savingsDelta: "5.00" }),
      ],
      "USD",
    );
    expect(s.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(s.rows.map((r) => r.savingsBalance)).toEqual(["5.00", "15.00"]);
    expect(s.totalSavings).toBe("15.00");
  });

  it("keeps fees apart from savings", () => {
    const s = buildStatement(
      [
        e({ type: "registration_fee", savingsDelta: "0.00", feeDelta: "20.00" }),
        e({ id: "c", createdAt: "2026-11-02T08:00:00Z", savingsDelta: "5.00" }),
      ],
      "USD",
    );
    expect(s.totalFees).toBe("20.00");
    expect(s.totalSavings).toBe("5.00");
    expect(s.rows[0]?.description).toBe("Registration fee");
  });

  it("shows a reversal as a negative line and nets it out", () => {
    const s = buildStatement(
      [
        e({ id: "p", savingsDelta: "5.00" }),
        e({
          id: "r",
          type: "reversal",
          reversesId: "p",
          createdAt: "2026-11-02T08:00:00Z",
          savingsDelta: "-5.00",
        }),
      ],
      "USD",
    );
    expect(s.totalSavings).toBe("0.00");
    expect(s.rows[1]?.description).toContain("Correction");
  });

  it("adds decimals exactly and ignores other currencies", () => {
    const s = buildStatement(
      [
        e({ savingsDelta: "0.10" }),
        e({ id: "d", createdAt: "2026-11-02T08:00:00Z", savingsDelta: "0.20" }),
        e({ id: "z", currency: "ZWG", savingsDelta: "99.00" }),
      ],
      "USD",
    );
    expect(s.totalSavings).toBe("0.30");
  });
});
