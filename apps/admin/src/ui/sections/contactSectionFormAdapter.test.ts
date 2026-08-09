import { describe, expect, it } from 'vitest';
import { defaultBusinessHoursDays } from '@bonae/content/schema';
import { buildEditedContactHours, getContactHoursTitleDefault } from './contactSectionFormAdapter.js';

describe('contact section form hours adapter', () => {
  it('keeps a valid structured schedule while applying the edited title', () => {
    const existingDays = defaultBusinessHoursDays().map((day) =>
      day.day === 'monday' ? { ...day, open: '10:00', close: '19:00' } : day,
    );
    const existingHours = {
      title: 'Business hours',
      days: existingDays,
    };

    expect(getContactHoursTitleDefault(existingHours)).toBe('Business hours');
    expect(buildEditedContactHours(existingHours, 'Hours')).toEqual({
      title: 'Hours',
      days: existingDays,
    });
  });

  it('preserves a legacy string title and writes a complete default schedule', () => {
    const editedHours = buildEditedContactHours('Mon-Fri 9am-6pm', 'Opening hours');

    expect(getContactHoursTitleDefault('Mon-Fri 9am-6pm')).toBe('Mon-Fri 9am-6pm');
    expect(editedHours).toEqual({
      title: 'Opening hours',
      days: defaultBusinessHoursDays(),
    });
  });

  it('preserves a partial object title but does not write an invalid empty days array', () => {
    const editedHours = buildEditedContactHours({ title: 'Horario' }, 'Horario actualizado');

    expect(getContactHoursTitleDefault({ title: 'Horario' })).toBe('Horario');
    expect(editedHours.title).toBe('Horario actualizado');
    expect(editedHours.days).toEqual(defaultBusinessHoursDays());
    expect(editedHours.days).toHaveLength(7);
  });
});
