import { describe, expect, it } from "vitest";
import {
  cumulativeCounts,
  moneyInByMonth,
  niceScale,
  percentOf,
  runningTotalByMonth,
  compactNumber,
  type LedgerPoint,
} from "@/lib/chart-utils";

const row = (
  createdAt: string,
  type: string,
  amount: string,
  savingsDelta = "0.00",
  feeDelta = "0.00",
): LedgerPoint => ({ createdAt, type, amount, savingsDelta, feeDelta });

const MONTHS = ["2026-08", "2026-09", "2026-10"];

describe("moneyInByMonth", () => {
  it("splits savings from fees and never mixes them", () => {
    const out = moneyInByMonth(
      [
        row("2026-09-05T10:00:00", "savings_contribution", "20.00", "20.00"),
        row(
          "2026-09-06T10:00:00",
          "monthly_subscription",
          "2.00",
          "0.00",
          "2.00",
        ),
        row(
          "2026-10-01T10:00:00",
          "registration_fee",
          "20.00",
          "0.00",
          "20.00",
        ),
      ],
      MONTHS,
    );
    expect(out[1]).toMatchObject({
      savings: "20.00",
      subscription: "2.00",
      registration: "0.00",
    });
    expect(out[2]).toMatchObject({ registration: "20.00", savings: "0.00" });
  });
  it("subtracts a reversed savings payment", () => {
    const out = moneyInByMonth(
      [
        row("2026-09-05T10:00:00", "savings_contribution", "20.00", "20.00"),
        row("2026-09-07T10:00:00", "reversal", "20.00", "-20.00"),
      ],
      MONTHS,
    );
    expect(out[1]!.savings).toBe("0.00");
  });
});

describe("fee reversals", () => {
  it("come off the same kind of fee they reverse", () => {
    const out = moneyInByMonth(
      [
        {
          ...row(
            "2026-09-05T10:00:00",
            "registration_fee",
            "20.00",
            "0.00",
            "20.00",
          ),
          id: "a",
        },
        {
          ...row("2026-09-06T10:00:00", "reversal", "20.00", "0.00", "-20.00"),
          reversesId: "a",
        },
      ],
      MONTHS,
    );
    expect(out[1]).toMatchObject({
      registration: "0.00",
      subscription: "0.00",
    });
  });
});

describe("runningTotalByMonth", () => {
  it("carries earlier money forward", () => {
    const totals = runningTotalByMonth(
      [
        row("2026-07-01T10:00:00", "savings_contribution", "10.00", "10.00"),
        row("2026-09-01T10:00:00", "savings_contribution", "5.50", "5.50"),
      ],
      MONTHS,
      (r) => r.savingsDelta,
    );
    expect(totals).toEqual(["10.00", "15.50", "15.50"]);
  });
});

describe("cumulativeCounts", () => {
  it("counts everyone who joined before the window", () => {
    expect(
      cumulativeCounts(["2026-01-01T00:00:00", "2026-09-10T00:00:00"], MONTHS),
    ).toEqual([1, 2, 2]);
  });
});

describe("scales", () => {
  it("rounds the top of an axis up to a tidy number", () => {
    const s = niceScale(87);
    expect(s.top).toBe(100);
    expect(s.ticks[0]).toBe(0);
  });
  it("copes with no data", () => {
    expect(niceScale(0).top).toBe(1);
  });
  it("formats compact numbers and percentages", () => {
    expect(compactNumber(1200)).toBe("1.2k");
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(1, 0)).toBe(0);
  });
});
