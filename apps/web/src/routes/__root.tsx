import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <AssistantWidget />
    </>
  ),
});
