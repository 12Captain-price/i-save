import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="i-Save home"
      className={`inline-flex items-center ${className}`}
    >
      <img
        src="/images/isave-logo-dark.webp"
        alt="i-Save: Saving today for a better tomorrow"
        width={600}
        height={240}
        className="h-10 w-auto max-w-[155px] rounded-md object-contain light:shadow-sm light:ring-1 light:ring-border"
      />
    </Link>
  );
}
