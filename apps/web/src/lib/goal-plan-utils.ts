// Pure helper for the full plan description. No database or browser code here.

export const LONG_DESCRIPTION_MAX = 4000; // the database enforces the same limit

export function validatePlanLongDescription(input: string): string | null {
  if (input.trim().length > LONG_DESCRIPTION_MAX) {
    return `Keep the full description under ${LONG_DESCRIPTION_MAX} characters.`;
  }
  return null;
}
