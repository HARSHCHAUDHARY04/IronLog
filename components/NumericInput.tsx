// ═══════════════════════════════════════════════════════
// NumericInput — keeps the raw text while typing so partial
// values like "62." or "0.5" aren't reformatted mid-entry.
// ═══════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface NumericInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  value: number;
  onChangeValue: (value: number) => void;
  allowDecimal?: boolean;
}

const format = (n: number) => (n > 0 ? String(n) : '');

export default function NumericInput({ value, onChangeValue, allowDecimal = true, onBlur, ...rest }: NumericInputProps) {
  const [text, setText] = useState(format(value));
  const lastEmitted = useRef(value);

  // Sync when the value changes from outside (plate calculator, unit switch, prefill)
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(format(value));
    }
  }, [value]);

  const handleChange = (raw: string) => {
    let cleaned = raw.replace(',', '.').replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
    if (allowDecimal) {
      const [whole, ...fraction] = cleaned.split('.');
      cleaned = fraction.length > 0 ? `${whole}.${fraction.join('').slice(0, 2)}` : whole;
    }
    setText(cleaned);
    const parsed = parseFloat(cleaned);
    const next = Number.isFinite(parsed) ? parsed : 0;
    lastEmitted.current = next;
    onChangeValue(next);
  };

  return (
    <TextInput
      {...rest}
      value={text}
      onChangeText={handleChange}
      onBlur={e => {
        setText(format(lastEmitted.current));
        onBlur?.(e);
      }}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
    />
  );
}
