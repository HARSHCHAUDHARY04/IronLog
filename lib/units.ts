import { useSettingsStore, UnitType } from '../stores/settingsStore';

// All weights are stored in kg; these helpers convert at the UI boundary.

// Converts kg to lbs
export const kgToLbs = (kg: number) => kg * 2.20462;

// Converts lbs to kg
export const lbsToKg = (lbs: number) => lbs / 2.20462;

const currentUnit = (): UnitType => useSettingsStore.getState().unit;

/** Reactive unit for components (re-renders when the setting changes) */
export const useUnit = (): UnitType => useSettingsStore(s => s.unit);

export const unitLabel = (unit: UnitType = currentUnit()) => unit;

/** kg → number in the user's unit, rounded to 0.1 */
export const toDisplayWeight = (kgValue: number, unit: UnitType = currentUnit()): number => {
  const v = unit === 'lbs' ? kgToLbs(kgValue) : kgValue;
  return Math.round(v * 10) / 10;
};

/** Number typed in the user's unit → kg for storage */
export const fromDisplayWeight = (value: number, unit: UnitType = currentUnit()): number =>
  unit === 'lbs' ? lbsToKg(value) : value;

// Formats a weight value based on the user's unit preference
// e.g. displayWeight(100) -> "100 kg" (or "220.5 lbs")
export const displayWeight = (
  kgValue: number | undefined | null,
  includeLabel = true,
  unit: UnitType = currentUnit()
): string => {
  const formatted = toDisplayWeight(kgValue ?? 0, unit);
  return includeLabel ? `${formatted} ${unit}` : `${formatted}`;
};

/** Compact volume, e.g. 12.3k kg */
export const displayVolume = (kgValue: number, unit: UnitType = currentUnit()): string => {
  const v = toDisplayWeight(kgValue, unit);
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k ${unit}` : `${Math.round(v)} ${unit}`;
};

// Takes user input in their preferred unit and converts it to kg for the database
export const parseInputToKg = (inputValue: number): number => fromDisplayWeight(inputValue);
