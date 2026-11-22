import { useState } from 'react';

// User-friendly numeric input that never fights Backspace or forces "1"/"0" mid-edit.
// Keeps free-form text while focused, emits valid numbers live, and clamps cleanly on blur.
export default function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  fallback = 0,
  allowEmpty = false,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = focused ? draft : value === '' || value == null ? '' : String(value);

  const handleFocus = (e) => {
    setFocused(true);
    setDraft(value === '' || value == null ? '' : String(value));
    if (rest.onFocus) rest.onFocus(e);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === '' || raw === '-' || raw === '.') {
      if (allowEmpty) onChange('');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = (e) => {
    setFocused(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      onChange(allowEmpty ? '' : fallback);
    } else {
      let parsed = Number(trimmed);
      if (Number.isNaN(parsed)) parsed = fallback;
      if (typeof min === 'number') parsed = Math.max(min, parsed);
      if (typeof max === 'number') parsed = Math.min(max, parsed);
      onChange(parsed);
    }
    if (rest.onBlur) rest.onBlur(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={step && Number(step) < 1 ? 'decimal' : 'numeric'}
      value={displayValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
