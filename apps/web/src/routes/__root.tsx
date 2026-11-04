import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { GoodbyeToast } from "@/components/site/GoodbyeToast";
import { SessionGuard } from "@/components/site/SessionGuard";
import { TrafficTracker } from "@/components/site/TrafficTracker";
import { WelcomeCelebration } from "@/components/site/WelcomeCelebration";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <AssistantWidget />
      <SessionGuard />
      <TrafficTracker />
      <WelcomeCelebration />
      <GoodbyeToast />
    </>
  ),
});
