import type { ContentDocument } from '@bonae/content';
import { asBusinessHours, defaultBusinessHoursDays } from '@bonae/content/schema';

function readContactHoursTitle(hours: unknown): string {
  if (hours && typeof hours === 'object' && typeof (hours as { title?: unknown }).title === 'string') {
    return (hours as { title: string }).title;
  }
  if (typeof hours === 'string') {
    return hours;
  }
  return '';
}

export function getContactHoursTitleDefault(hours: unknown): string {
  return asBusinessHours(hours)?.title ?? readContactHoursTitle(hours);
}

export function buildEditedContactHours(
  existingHours: unknown,
  title: string,
): NonNullable<ContentDocument['contact']['hours']> {
  return {
    title,
    days: asBusinessHours(existingHours)?.days ?? defaultBusinessHoursDays(),
  };
}
