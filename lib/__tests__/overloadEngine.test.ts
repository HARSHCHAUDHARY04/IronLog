import { analyzeOverload, calculate1RM, SessionData, ExerciseSet } from '../overloadEngine';

const session = (date: string, weight: number, reps: number): SessionData => {
  const s: ExerciseSet = {
    id: date, exercise_name: 'Squat', set_number: 1, reps, weight_kg: weight,
    is_warmup: false, estimated_1rm: calculate1RM(weight, reps),
  };
  return { workout_date: date, sets: [s], best_1rm: s.estimated_1rm, total_volume: weight * reps };
};

describe('calculate1RM', () => {
  it('uses the Epley formula', () => {
    expect(calculate1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(calculate1RM(100, 1)).toBe(100);
    expect(calculate1RM(0, 5)).toBe(0);
  });
});

describe('analyzeOverload', () => {
  it('needs three sessions before analysing', () => {
    expect(analyzeOverload([]).status).toBe('new_exercise');
    expect(analyzeOverload([session('2026-10-02', 100, 5)]).status).toBe('insufficient_data');
  });

  it('suggests a +2.5 kg jump rounded to a loadable weight when progressing', () => {
    // newest first
    const result = analyzeOverload([
      session('2026-10-09', 57.5, 8),
      session('2026-10-05', 55, 8),
      session('2026-10-01', 52.5, 8),
    ]);
    expect(result.status).toBe('progressing');
    expect(result.suggestedWeight).toBe(60);

    // Odd working weights still land on a 2.5 kg increment (was Math.ceil → 64)
    const odd = analyzeOverload([
      session('2026-10-09', 61.25, 8),
      session('2026-10-05', 57.5, 8),
      session('2026-10-01', 55, 8),
    ]);
    expect((odd.suggestedWeight! / 2.5) % 1).toBe(0);
  });

  it('suggests more reps on a plateau below 8 reps', () => {
    const result = analyzeOverload([
      session('2026-10-09', 100, 5),
      session('2026-10-05', 100, 5),
      session('2026-10-01', 100, 5),
    ]);
    expect(result.status).toBe('plateau');
    expect(result.recommendation).toBe('reps_up');
    expect(result.suggestedReps).toBe(6);
  });
});
