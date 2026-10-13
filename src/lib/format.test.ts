import { describe, expect, it } from 'vitest';
import {
  durationText,
  formatBalance,
  formatDate,
  formatMinutes,
  parseDuration,
  shiftMinutes,
} from './format';

describe('format', () => {
  it('formats dates and durations', () => {
    expect(formatDate('2026-03-02')).toBe('02/03/2026');
    expect(formatMinutes(690)).toBe('11h30');
    expect(formatMinutes(720)).toBe('12h');
    expect(durationText(690)).toBe('11:30');
  });

  it('formats and parses signed balances', () => {
    expect(durationText(-450)).toBe('-7:30');
    expect(parseDuration('-7:30')).toBe(-450);
    expect(parseDuration('+12')).toBe(720);
    expect(formatBalance(750)).toBe('+12h30');
    expect(formatBalance(-420)).toBe('-7h');
    expect(formatBalance(0)).toBe('0h');
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
