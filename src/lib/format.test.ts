import { describe, expect, it } from 'vitest';
import { durationText, formatDate, formatMinutes, parseDuration, shiftMinutes } from './format';

describe('format', () => {
  it('formats dates and durations', () => {
    expect(formatDate('2026-03-02')).toBe('02/03/2026');
    expect(formatMinutes(690)).toBe('11h30');
    expect(formatMinutes(720)).toBe('12h');
    expect(durationText(690)).toBe('11:30');
  });

  it('parses durations', () => {
    expect(parseDuration('11:30')).toBe(690);
    expect(parseDuration('48')).toBe(2880);
    expect(parseDuration('11h')).toBeNaN();
  });

  it('measures shifts across midnight', () => {
    expect(shiftMinutes('07:00', '19:00')).toBe(720);
    expect(shiftMinutes('19:00', '07:00')).toBe(720);
  });
});
