/** Build a stored displayName from first + last. */
export function buildDisplayName(firstName?: string | null, lastName?: string | null): string {
  return [firstName?.trim() || '', lastName?.trim() || '']
    .filter(Boolean)
    .join(' ');
}

/** Split a legacy full name into first/last. */
export function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = displayName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const i = trimmed.indexOf(' ');
  if (i < 0) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, i),
    lastName: trimmed.slice(i + 1).trim(),
  };
}
