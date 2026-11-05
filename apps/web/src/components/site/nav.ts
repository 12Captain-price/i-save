// Public pages are built one by one. Until a page exists it is linked with a plain <a>,
// because the typed router Link only accepts routes that exist in the route tree.
export const NAV = [
  { label: "Home", href: "/" },
  { label: "Savings goals", href: "/plans" },
  { label: "Fees", href: "/fees" },
  { label: "Announcements", href: "/announcements" },
  { label: "Events", href: "/events" },
  { label: "Our team", href: "/team" },
  { label: "Reviews", href: "/reviews" },
  { label: "Feedback", href: "/feedback" },
  { label: "Contact", href: "/contact" },
] as const;

export const INFO_LINKS = [
  { label: "Member reviews", href: "/reviews" },
  { label: "Send us feedback", href: "/feedback" },
  { label: "FAQs", href: "/faqs" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Risk and withdrawal disclosure", href: "/disclosures" },
] as const;
