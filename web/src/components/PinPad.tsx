import { useEffect, useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
const MAX = 10;

/**
 * Big on-screen number pad. Kids use this on a phone, so the targets are large
 * and there is no text keyboard to fight with — but a hardware keyboard still
 * works for parents on a laptop.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  minLength = 4,
  shake,
}: {
  value: string;
  onChange: (pin: string) => void;
  /** Fired when the kid presses ✓, or on Enter. */
  onComplete?: () => void;
  minLength?: number;
  shake?: boolean;
}) {
  const [pressed, setPressed] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        if (value.length < MAX) onChange(value + e.key);
        setPressed(e.key);
        setTimeout(() => setPressed(null), 120);
      } else if (e.key === 'Backspace') {
        onChange(value.slice(0, -1));
      } else if (e.key === 'Enter' && value.length >= minLength) {
        onComplete?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, onComplete, minLength]);

  const press = (key: string) => {
    if (key === '⌫') onChange(value.slice(0, -1));
    else if (key && value.length < MAX) onChange(value + key);
  };

  return (
    <div>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-hidden>
        {Array.from({ length: Math.max(minLength, value.length) }, (_, i) => (
          <span key={i} className={`pin-dot ${i < value.length ? 'is-filled' : ''}`} />
        ))}
      </div>

      <div className="pin-pad">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            className={`pin-key ${key === '' ? 'is-blank' : ''} ${pressed === key ? 'is-pressed' : ''}`}
            onClick={() => press(key)}
            disabled={key === ''}
            aria-label={key === '⌫' ? 'Backspace' : key}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
