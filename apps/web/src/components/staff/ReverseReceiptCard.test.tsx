import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptDetail } from "@/lib/staff";

const { reversePayment } = vi.hoisted(() => ({ reversePayment: vi.fn() }));
vi.mock("@/lib/staff", () => ({ reversePayment }));

import { ReverseReceiptCard } from "./ReverseReceiptCard";

const receipt: ReceiptDetail = {
  id: "r1",
  receiptNumber: "RCT-00000004",
  purpose: "savings_contribution",
  amount: "5.00",
  currency: "USD",
  provider: "office_cash",
  officeReceiptNo: "testing 4",
  issuedAt: "2026-11-01T11:20:00Z",
  reversed: false,
  ledgerId: "ledger-1",
  reversal: null,
  memberId: "m1",
  memberNumber: "ISV-000001",
  memberName: "Tanaka Chikanya",
  issuedByName: "Office Clerk",
};

function renderCard(r: ReceiptDetail = receipt) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReverseReceiptCard receipt={r} />
    </QueryClientProvider>,
  );
}

describe("ReverseReceiptCard", () => {
  beforeEach(() => {
    reversePayment.mockReset();
  });

  it("does not show for a receipt that is already reversed", () => {
    renderCard({ ...receipt, reversed: true });
    expect(screen.queryByText("Reverse this payment")).not.toBeInTheDocument();
  });

  it("refuses to continue without a reason", () => {
    renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Reverse this payment" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Review reversal" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 5/i);
    expect(reversePayment).not.toHaveBeenCalled();
  });

  it("needs a second confirmation, then reverses with the ledger id and reason", async () => {
    reversePayment.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Reverse this payment" }),
    );
    fireEvent.change(screen.getByLabelText(/why is this payment/i), {
      target: { value: "  Entered against wrong member " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reversal" }));
    expect(reversePayment).not.toHaveBeenCalled();
    expect(screen.getByText(/due again/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm reversal" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Payment reversed/),
    );
    expect(reversePayment).toHaveBeenCalledWith(
      "ledger-1",
      "  Entered against wrong member ",
    );
  });

  it("shows the database message when the reversal is refused", async () => {
    reversePayment.mockImplementation(async () => {
      throw new Error("This would make the savings balance negative");
    });
    renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Reverse this payment" }),
    );
    fireEvent.change(screen.getByLabelText(/why is this payment/i), {
      target: { value: "Wrong amount" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review reversal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reversal" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/negative/i),
    );
    expect(
      screen.getByRole("button", { name: "Confirm reversal" }),
    ).toBeEnabled();
  });
});
