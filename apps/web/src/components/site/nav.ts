// Public pages are built one by one. Until a page exists it is linked with a plain <a>,
// because the typed router Link only accepts routes that exist in the route tree.
export const NAV = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Savings goals", href: "/plans" },
  { label: "Fees", href: "/fees" },
  { label: "Contact", href: "/contact" },
] as const;

export const INFO_LINKS = [
  { label: "FAQs", href: "/faqs" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Risk and withdrawal disclosure", href: "/disclosures" },
] as const;
