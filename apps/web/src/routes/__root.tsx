import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ConfirmProvider } from "@/components/ui/confirm";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { GoodbyeToast } from "@/components/site/GoodbyeToast";
import { SessionGuard } from "@/components/site/SessionGuard";
import { TrafficTracker } from "@/components/site/TrafficTracker";
import { WelcomeCelebration } from "@/components/site/WelcomeCelebration";

export const Route = createRootRoute({
  component: () => (
    <ConfirmProvider>
      <Outlet />
      <AssistantWidget />
      <SessionGuard />
      <TrafficTracker />
      <WelcomeCelebration />
      <GoodbyeToast />
    </ConfirmProvider>
  ),
});
