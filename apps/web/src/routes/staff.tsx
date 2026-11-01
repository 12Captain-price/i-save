import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/staff/StaffShell";

// Layout route: /staff, /staff/members/:id and /staff/report all render inside StaffShell.
export const Route = createFileRoute("/staff")({
  component: StaffShell,
});
