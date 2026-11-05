// Pure helpers and settings for the count-up stat tiles on the home page.

/**
 * PLACEHOLDER. This is an illustrative figure, not a real count. Replace it with the member
 * number the owner approves before launch, or set it to null to hide the Members tile.
 */
export const HOME_MEMBER_COUNT: number | null = 3200;

/** Eases out: fast at the start, slow at the end. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** The number to show part-way through a count-up. At progress 1 it is exactly the target. */
export function countAt(target: number, progress: number): number {
  if (progress >= 1) return target;
  return Math.round(target * easeOutCubic(progress));
}

/** 1250 becomes "1,250". Always the same grouping, whatever the visitor's device language. */
export function formatCount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
