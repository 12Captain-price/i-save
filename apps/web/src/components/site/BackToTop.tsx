import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { prefersReducedMotion } from "@/components/ui/motion";

/** A small "back to top" button, bottom-left, that appears after scrolling down a long way. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        })
      }
      aria-label="Back to top"
      className="fixed bottom-4 left-4 z-[55] flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
    >
      <ArrowUp aria-hidden="true" className="size-5" />
    </button>
  );
}
