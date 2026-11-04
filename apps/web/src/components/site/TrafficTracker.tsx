import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-utils";
import { recordTraffic } from "@/lib/traffic";
import { cleanPath, isApplyHref, shouldTrack } from "@/lib/traffic-utils";

/**
 * Counts page views and clicks on "Apply to membership" links. It renders nothing.
 * Signed-in staff are not counted, so testing the site does not change the figures.
 */
export function TrafficTracker() {
  const { loading, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const staff = isStaffRole(roles);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (loading || staff) return;
    const clean = cleanPath(path);
    if (!shouldTrack(clean) || lastPath.current === clean) return;
    lastPath.current = clean;
    void recordTraffic("page_view", clean);
  }, [loading, staff, path]);

  useEffect(() => {
    if (loading || staff) return;
    function onClick(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest("a");
      if (!link || !isApplyHref(link.getAttribute("href"))) return;
      const from = cleanPath(window.location.pathname);
      if (from === "/apply" || !shouldTrack(from)) return;
      void recordTraffic("apply_click", from);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [loading, staff]);

  return null;
}
