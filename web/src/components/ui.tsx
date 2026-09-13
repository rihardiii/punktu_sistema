import {
  createContext,
  useId,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '../i18n.tsx';
import type { ReviewStatus } from '../types.ts';

// ---------------------------------------------------------------- Button

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'good' | 'bad' | 'ghost';
  size?: 'md' | 'sm';
  block?: boolean;
  busy?: boolean;
};

export function Button({
  variant = 'default',
  size = 'md',
  block,
  busy,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || busy} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : children}
    </button>
  );
}

// ---------------------------------------------------------------- Card

export function Card({
  title,
  action,
  children,
  flat,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  flat?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${flat ? 'card-flat' : ''} ${className}`}>
      {(title || action) && (
        <header className="row-between" style={{ marginBottom: 'var(--s3)' }}>
          {title && <div className="card-title" style={{ margin: 0 }}>{title}</div>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Avatar

export function Avatar({
  emoji,
  color,
  size = 'md',
}: {
  emoji: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={color ? { background: `color-mix(in srgb, ${color} 22%, transparent)` } : undefined}
      aria-hidden
    >
      {emoji || '🙂'}
    </span>
  );
}

// ---------------------------------------------------------------- Badge

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const { t } = useI18n();
  const label = status === 'pending' ? t('pending') : status === 'approved' ? t('approved') : t('rejected');
  const icon = status === 'pending' ? '⏳' : status === 'approved' ? '✅' : '✖️';
  return (
    <span className={`badge badge-${status}`}>
      {icon} {label}
    </span>
  );
}

// ---------------------------------------------------------------- Empty state

export function Empty({ icon = '🌱', text }: { icon?: string; text: string }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <p>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Modal

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the panel so screen readers and keyboards land inside the dialog.
    ref.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="×">
            ✕
          </button>
        </div>
        <div className="col">{children}</div>
        {footer && (
          <div className="row" style={{ marginTop: 'var(--s5)', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Field

export function Field({
  label,
  hint,
  error,
  composite,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /**
   * Set for groups of controls (segmented buttons, swatches, emoji grids)
   * rather than a single input. A <label> wrapping several buttons folds its
   * whole text into every button's accessible name — "Tēma 🌙 Tumšā ⚙️
   * Sistēmas" instead of "Tumšā" — so those get a labelled group instead.
   */
  composite?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();
  const body = (
    <>
      <span className="label" id={composite ? labelId : undefined}>
        {label}
      </span>
      {children}
      {error ? <span className="error-text">{error}</span> : hint && <span className="hint">{hint}</span>}
    </>
  );

  if (composite) {
    return (
      <div className="field" role="group" aria-labelledby={labelId}>
        {body}
      </div>
    );
  }
  return <label className="field">{body}</label>;
}

// ---------------------------------------------------------------- Segmented

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Toasts

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

interface ToastCtx {
  show: (text: string, tone?: Toast['tone']) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((text: string, tone: Toast['tone'] = 'neutral') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone !== 'neutral' ? `is-${toast.tone}` : ''}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// ---------------------------------------------------------------- Confetti

/**
 * A short burst of confetti when a kid's deed is approved. Purely decorative,
 * and skipped entirely when the user prefers reduced motion.
 */
export function Confetti({ onDone }: { onDone: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.8 + Math.random() * 1.2,
        color: ['#6C8EF5', '#2FAE7D', '#F2C14E', '#E0568B', '#E8623C'][i % 5]!,
      })),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Loading

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  );
}

// ---------------------------------------------------------------- Date

/** "Šodien 14:30" / "Today 14:30" — a kid should not have to parse ISO dates. */
export function useFormatDate() {
  const { lang } = useI18n();
  return useCallback(
    (iso: string) => {
      // SQLite writes "YYYY-MM-DD HH:MM:SS" in UTC with no timezone marker.
      const date = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
      if (Number.isNaN(date.getTime())) return iso;

      const now = new Date();
      const sameDay = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      const time = date.toLocaleTimeString(lang === 'lv' ? 'lv-LV' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (sameDay) return `${lang === 'lv' ? 'Šodien' : 'Today'} ${time}`;
      if (date.toDateString() === yesterday.toDateString())
        return `${lang === 'lv' ? 'Vakar' : 'Yesterday'} ${time}`;

      return date.toLocaleDateString(lang === 'lv' ? 'lv-LV' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      });
    },
    [lang],
  );
}
