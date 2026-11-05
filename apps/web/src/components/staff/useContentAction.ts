import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { staffErrorMessage } from "@/lib/staff-utils";

/** Runs a change, then refreshes every public and staff list so screens never show stale text. */
export function useContentAction() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(change: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await change();
      await queryClient.invalidateQueries({ queryKey: ["content"] });
      // The waiting-for-you badges in the staff menu depend on reviews and feedback.
      await queryClient.invalidateQueries({ queryKey: ["feedback"] });
      return true;
    } catch (e) {
      setError(staffErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
