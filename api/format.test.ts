import { describe, expect, it } from 'vitest';
import { formatDate, formatDayMonth, formatMinutes } from './format';

describe('format', () => {
  it('writes dates in French', () => {
    expect(formatDate('2026-03-02')).toBe('02/03/2026');
    expect(formatDayMonth('2026-03-02')).toBe('02/03');
  });

  it('writes durations in hours', () => {
    expect(formatMinutes(690)).toBe('11h30');
    expect(formatMinutes(720)).toBe('12h');
    expect(formatMinutes(5)).toBe('0h05');
  });
});
