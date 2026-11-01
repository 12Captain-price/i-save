import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptSlip } from "./ReceiptSlip";
import type { ReceiptDetail } from "@/lib/staff";

const base: ReceiptDetail = {
  id: "r1",
  receiptNumber: "RCT-00000004",
  purpose: "savings_contribution",
  amount: "5.00",
  currency: "USD",
  provider: "office_cash",
  officeReceiptNo: "testing 4",
  issuedAt: "2026-11-01T11:20:00Z",
  reversed: false,
  memberId: "m1",
  memberNumber: "ISV-000001",
  memberName: "Tanaka Chikanya",
  issuedByName: "Office Clerk",
};

describe("ReceiptSlip", () => {
  it("shows the receipt, member, amount and book number", () => {
    render(<ReceiptSlip receipt={base} printedAt="1 Nov 2026, 13:30" />);
    expect(screen.getByText("RCT-00000004")).toBeInTheDocument();
    expect(screen.getByText("Tanaka Chikanya")).toBeInTheDocument();
    expect(screen.getByText("ISV-000001")).toBeInTheDocument();
    expect(screen.getByText("testing 4")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText(/Received by: Office Clerk/)).toBeInTheDocument();
    expect(screen.getByText(/added to your savings/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says a fee is not savings", () => {
    render(
      <ReceiptSlip
        receipt={{ ...base, purpose: "registration_fee", amount: "20.00" }}
        printedAt="x"
      />,
    );
    expect(screen.getByText(/not added to your savings/i)).toBeInTheDocument();
  });

  it("warns clearly when the payment was reversed", () => {
    render(<ReceiptSlip receipt={{ ...base, reversed: true }} printedAt="x" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer valid/i);
  });

  it("falls back when the staff name is unknown", () => {
    render(
      <ReceiptSlip receipt={{ ...base, issuedByName: null }} printedAt="x" />,
    );
    expect(screen.getByText(/Received by: i-Save office/)).toBeInTheDocument();
  });
});
