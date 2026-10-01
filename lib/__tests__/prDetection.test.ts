import { checkForPRs } from '../prDetection';
import { ExerciseSet } from '../overloadEngine';

const set = (weight_kg: number, reps: number, is_warmup = false): ExerciseSet => ({
  id: Math.random().toString(),
  exercise_name: 'Bench',
  set_number: 1,
  reps,
  weight_kg,
  is_warmup,
  estimated_1rm: 0,
});

const NONE = { oneRM: 0, volume: 0, maxReps: 0 };

describe('checkForPRs', () => {
  it('celebrates the first 1RM and records volume/rep baselines', () => {
    const results = checkForPRs('Bench', [set(60, 8), set(60, 8)], NONE);
    const byType = Object.fromEntries(results.map(r => [r.record_type, r]));

    expect(byType['1rm'].is_pr).toBe(true);
    expect(byType['volume']).toMatchObject({ is_pr: false, is_baseline: true, new_value: 960 });
    expect(byType['reps']).toMatchObject({ is_pr: false, is_baseline: true, new_value: 8 });
  });

  it('detects volume and rep PRs once baselines exist', () => {
    const history = { oneRM: 100, volume: 900, maxReps: 8 };
    const results = checkForPRs('Bench', [set(60, 10), set(60, 9)], history);
    const types = results.filter(r => r.is_pr).map(r => r.record_type).sort();
    expect(types).toEqual(['reps', 'volume']);
  });

  it('ignores warm-up sets for volume', () => {
    const history = { oneRM: 100, volume: 500, maxReps: 10 };
    const results = checkForPRs('Bench', [set(100, 10, true), set(40, 10)], history);
    expect(results.find(r => r.record_type === 'volume')).toBeUndefined();
  });

  it('returns nothing when no working sets were logged', () => {
    expect(checkForPRs('Bench', [set(0, 10), set(50, 0)], NONE)).toEqual([]);
  });

  it('reports a 1RM improvement percentage', () => {
    const results = checkForPRs('Bench', [set(100, 5)], { oneRM: 100, volume: 10000, maxReps: 20 });
    const oneRM = results.find(r => r.record_type === '1rm')!;
    expect(oneRM.is_pr).toBe(true);
    expect(oneRM.previous_value).toBe(100);
    expect(oneRM.improvement_pct).toBeCloseTo(16.7, 1);
  });
});
