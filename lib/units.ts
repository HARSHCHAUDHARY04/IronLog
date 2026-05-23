import { useSettingsStore } from '../stores/settingsStore';

// Converts kg to lbs
export const kgToLbs = (kg: number) => kg * 2.20462;

// Converts lbs to kg
export const lbsToKg = (lbs: number) => lbs / 2.20462;

// Formats a weight value based on the user's unit preference
// e.g. displayWeight(100) -> "100 kg" (or "220.5 lbs")
export const displayWeight = (kgValue: number | undefined | null, includeLabel = true): string => {
  if (kgValue === undefined || kgValue === null) return includeLabel ? `0 kg` : '0';
  
  const unit = useSettingsStore.getState().unit;
  
  if (unit === 'lbs') {
    const lbs = kgToLbs(kgValue);
    // Round to 1 decimal place if needed
    const formatted = Math.round(lbs * 10) / 10;
    return includeLabel ? `${formatted} lbs` : `${formatted}`;
  }
  
  const formatted = Math.round(kgValue * 10) / 10;
  return includeLabel ? `${formatted} kg` : `${formatted}`;
};

// Takes user input in their preferred unit and converts it to kg for the database
export const parseInputToKg = (inputValue: number): number => {
  const unit = useSettingsStore.getState().unit;
  if (unit === 'lbs') {
    return lbsToKg(inputValue);
  }
  return inputValue;
};
