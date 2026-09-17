import { useState } from 'react';
import { useI18n } from '../i18n.tsx';

/**
 * Emoji sets, grouped so a parent adding "feed the cat" finds a cat fast.
 * Emoji rather than image uploads: nothing to store, nothing to resize, and it
 * renders identically on a phone, a laptop and a TV browser.
 *
 * Each group holds a mix of the specific ("wash the dishes") and the generic
 * (a star, a box, a clock), because half the deeds a family invents have no
 * emoji of their own and want something neutral that still reads at a glance.
 *
 * Keep every entry at most 8 UTF-16 units — that is the `icon` column's limit
 * on the server, and a long family/profession sequence blows straight past it.
 */
const GROUPS: Array<{ key: string; label: { lv: string; en: string }; emoji: string[] }> = [
  {
    key: 'home',
    label: { lv: 'Mājas', en: 'Home' },
    emoji: [
      '🏠', '🧹', '🧽', '🧼', '🧺', '🛏️', '🗑️', '🧷',
      '🪣', '🪑', '🚪', '🪟', '🛋️', '🖼️', '💡', '🔌',
      '🧰', '🔨', '🪛', '📦', '🔑', '⏰', '🕯️', '🪴',
    ],
  },
  {
    key: 'bathroom',
    label: { lv: 'Vannasistaba', en: 'Bathroom' },
    emoji: [
      '🚿', '🛁', '🚽', '🧻', '🪥', '🦷', '🧼', '🧴',
      '🧽', '🪒', '🪞', '🫧', '💦', '💧', '🧺', '👕',
      '🩲', '🧦', '🧢', '💈', '🪠', '♻️', '🪣', '⏱️',
    ],
  },
  {
    key: 'health',
    label: { lv: 'Veselība', en: 'Health' },
    emoji: [
      '💊', '🩹', '🩺', '🏥', '💪', '🧘', '🏃', '😷',
      '🤒', '🌡️', '💉', '🩼', '👓', '🧠', '🦴', '❤️‍🩹',
      '🍏', '🥦', '🥕', '🥤', '😴', '🛌', '⚕️', '🚶',
    ],
  },
  {
    key: 'kitchen',
    label: { lv: 'Virtuve', en: 'Kitchen' },
    emoji: [
      '🍽️', '🥣', '🍳', '🍲', '🥗', '🧑‍🍳', '☕', '🥛',
      '🍞', '🧊', '🍱', '🥄', '🍴', '🔪', '🧂', '🥘',
      '🍚', '🍎', '🍌', '🧁', '🫖', '🥫', '🧈', '🍪',
    ],
  },
  {
    key: 'school',
    label: { lv: 'Skola', en: 'School' },
    emoji: [
      '📚', '✏️', '📝', '🎒', '🧮', '🔬', '🎨', '🎼',
      '🗂️', '📖', '🖍️', '📐', '🖊️', '📏', '🏫', '💻',
      '🧪', '🌍', '⏳', '📎', '🔤', '🎻', '🥇', '📅',
    ],
  },
  {
    key: 'family',
    label: { lv: 'Ģimene', en: 'Family' },
    emoji: [
      '🧸', '👶', '🤝', '😊', '❤️', '🫂', '🎁', '🙏',
      '👏', '🗣️', '🧑‍🤝‍🧑', '🌈', '👪', '💌', '🕊️', '🍀',
      '⭐', '✨', '💬', '🤗', '🧡', '💛', '💚', '🔔',
    ],
  },
  {
    key: 'outside',
    label: { lv: 'Ārā', en: 'Outside' },
    emoji: [
      '🌱', '🌳', '🐾', '🚲', '⚽', '🍂', '❄️', '🌻',
      '🐕', '🐈', '🌷', '🚗', '🌲', '☀️', '🌧️', '⛄',
      '🛴', '🏀', '🧤', '🍃', '🐦', '🪺', '🏞️', '🥾',
    ],
  },
  {
    key: 'rewards',
    label: { lv: 'Balvas', en: 'Rewards' },
    emoji: [
      '🎮', '📱', '🍿', '🍦', '💶', '🌙', '🍕', '🏕️',
      '🎬', '🎡', '🛝', '🍭', '🎲', '🧩', '🎯', '🎪',
      '🏊', '🎳', '🍫', '🎧', '🚀', '🛍️', '💰', '🎟️',
    ],
  },
  {
    key: 'faces',
    label: { lv: 'Sejas', en: 'Faces' },
    emoji: [
      '🙂', '😀', '😎', '🤩', '🥳', '🦊', '🐼', '🐻',
      '🦁', '🐧', '🦄', '🐯', '😍', '🤓', '🤠', '🐶',
      '🐱', '🐰', '🐢', '🐸', '🐵', '🦉', '🐝', '🐙',
    ],
  },
];

export function EmojiPicker({
  value,
  onChange,
  allowEmpty = true,
}: {
  value: string;
  onChange: (emoji: string) => void;
  allowEmpty?: boolean;
}) {
  const { lang, t } = useI18n();
  const [group, setGroup] = useState(GROUPS[0]!.key);
  const active = GROUPS.find((g) => g.key === group) ?? GROUPS[0]!;

  return (
    <div className="col" style={{ gap: 'var(--s2)' }}>
      <div className="row wrap" style={{ gap: 4 }}>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`btn btn-sm ${g.key === group ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setGroup(g.key)}
          >
            {g.label[lang] ?? g.label.lv}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
          gap: 'var(--s2)',
          padding: 'var(--s2)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}
      >
        {allowEmpty && (
          <button
            type="button"
            className={`btn ${value === '' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 46, padding: 0, fontSize: '0.7rem' }}
            onClick={() => onChange('')}
            title={t('optional')}
          >
            —
          </button>
        )}
        {active.emoji.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`btn ${value === emoji ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: 46, padding: 0, fontSize: '1.4rem' }}
            onClick={() => onChange(emoji)}
            aria-label={emoji}
            aria-pressed={value === emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
