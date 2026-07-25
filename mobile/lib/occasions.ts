import type { OccasionKind } from '@/lib/api';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function occasionEmoji(kind: OccasionKind) {
  switch (kind) {
    case 'birthday':
      return '🎂';
    case 'anniversary':
      return '💕';
    case 'remembrance':
      return '🕯️';
    default:
      return '📅';
  }
}

/**
 * The API sends plain YYYY-MM-DD, so read it back in UTC. Local getters would
 * shift the day backwards for anyone west of Greenwich.
 */
export function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function whenLabel(daysUntil: number, iso: string) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 30) return `in ${daysUntil} days`;
  return formatShortDate(iso);
}
