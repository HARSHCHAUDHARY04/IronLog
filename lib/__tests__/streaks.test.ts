import { calculateStreaks } from '../streaks';

const TODAY = '2026-10-10';

describe('calculateStreaks', () => {
  it('returns zeros with no workouts', () => {
    expect(calculateStreaks([], 2, TODAY)).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('counts consecutive days with strict gap of 1', () => {
    const dates = ['2026-10-10', '2026-10-09', '2026-10-08'];
    expect(calculateStreaks(dates, 1, TODAY)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('allows a rest day when gap is 2', () => {
    const dates = ['2026-10-10', '2026-10-08', '2026-10-06', '2026-10-01'];
    expect(calculateStreaks(dates, 2, TODAY)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('keeps the streak alive within the grace window', () => {
    // Last workout yesterday, gap 2 → still current
    expect(calculateStreaks(['2026-10-09', '2026-10-08'], 2, TODAY).currentStreak).toBe(2);
    // Last workout 3 days ago, gap 2 → broken
    expect(calculateStreaks(['2026-10-07', '2026-10-06'], 2, TODAY).currentStreak).toBe(0);
  });

  it('tracks the longest historical streak separately', () => {
    const dates = [
      '2026-10-10',
      '2026-09-20', '2026-09-19', '2026-09-18', '2026-09-17',
    ];
    expect(calculateStreaks(dates, 1, TODAY)).toEqual({ currentStreak: 1, longestStreak: 4 });
  });

  it('ignores duplicate workouts on the same day', () => {
    const dates = ['2026-10-10', '2026-10-10', '2026-10-09'];
    expect(calculateStreaks(dates, 1, TODAY)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });
});
