import { describe, expect, it } from 'vitest';
import { durationText, formatBalance, parseDuration } from './format';

describe('format', () => {
  it('writes a duration in its editable form', () => {
    expect(durationText(690)).toBe('11:30');
    expect(durationText(Number.NaN)).toBe('');
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
});
