import {
  Baby,
  Briefcase,
  Building2,
  Car,
  Gift,
  GraduationCap,
  Heart,
  House,
  Plane,
  Shield,
  Sprout,
  Stethoscope,
  Store,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// The icons and colours an admin can pick for a savings goal. The database stores only the
// short code (for example "plane" or "gold"), so a bad value falls back to a safe default.

export const GOAL_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  building: { label: "Building", icon: Building2 },
  plane: { label: "Plane", icon: Plane },
  shield: { label: "Shield", icon: Shield },
  briefcase: { label: "Briefcase", icon: Briefcase },
  graduation: { label: "Graduation cap", icon: GraduationCap },
  home: { label: "Home", icon: House },
  car: { label: "Car", icon: Car },
  heart: { label: "Heart", icon: Heart },
  baby: { label: "Baby", icon: Baby },
  store: { label: "Shop or business", icon: Store },
  sprout: { label: "Farming or growth", icon: Sprout },
  wallet: { label: "Wallet", icon: Wallet },
  gift: { label: "Gift or wedding", icon: Gift },
  health: { label: "Health", icon: Stethoscope },
  target: { label: "Target", icon: Target },
};

export const GOAL_ACCENTS: Record<string, { label: string; color: string }> = {
  gold: { label: "Gold", color: "oklch(0.8 0.14 85)" },
  blue: { label: "Blue", color: "oklch(0.8 0.12 220)" },
  red: { label: "Red", color: "oklch(0.74 0.17 25)" },
  purple: { label: "Purple", color: "oklch(0.78 0.13 300)" },
  green: { label: "Green", color: "oklch(0.86 0.19 163)" },
  orange: { label: "Orange", color: "oklch(0.8 0.15 55)" },
  pink: { label: "Pink", color: "oklch(0.8 0.13 350)" },
  teal: { label: "Teal", color: "oklch(0.82 0.1 190)" },
};

export function goalIcon(code: string | null | undefined): LucideIcon {
  return (code && GOAL_ICONS[code]?.icon) || Target;
}

export function goalColor(code: string | null | undefined): string {
  return (code && GOAL_ACCENTS[code]?.color) || GOAL_ACCENTS.green!.color;
}

/** "Wedding fund!" becomes "wedding-fund": the short code a goal is stored under. */
export function slugifyGoal(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}
