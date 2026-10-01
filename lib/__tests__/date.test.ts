import { toLocalDateStr, parseLocalDate, daysBetween, startOfWeek, addDays } from '../date';

describe('date helpers', () => {
  it('formats the local calendar day, not the UTC day', () => {
    // 00:30 local time on 5 Jan — in UTC+5:30 this is still 4 Jan in UTC
    expect(toLocalDateStr(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(toLocalDateStr(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-03-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips through parse and format', () => {
    expect(toLocalDateStr(parseLocalDate('2026-07-14'))).toBe('2026-07-14');
  });

  it('counts calendar days between dates', () => {
    expect(daysBetween('2026-01-10', '2026-01-09')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-02-27')).toBe(2);
    expect(daysBetween('2026-01-01', '2025-12-31')).toBe(1);
    expect(daysBetween('2026-01-09', '2026-01-09')).toBe(0);
  });

  it('starts weeks on Monday', () => {
    // Wed 7 Oct 2026 → Mon 5 Oct
    expect(toLocalDateStr(startOfWeek(new Date(2026, 9, 7)))).toBe('2026-10-05');
    // Sunday belongs to the week that started the previous Monday
    expect(toLocalDateStr(startOfWeek(new Date(2026, 9, 11)))).toBe('2026-10-05');
    // Monday is its own start
    expect(toLocalDateStr(startOfWeek(new Date(2026, 9, 5, 15)))).toBe('2026-10-05');
  });

  it('adds days across month boundaries', () => {
    expect(toLocalDateStr(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(toLocalDateStr(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
  });
});
