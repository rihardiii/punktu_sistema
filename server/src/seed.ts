import { db } from './db.ts';
import { replaceWindows, type TimeWindow } from './deeds.ts';

/** Minutes since midnight, so the table below stays readable. */
const at = (hour: number, minute = 0): number => hour * 60 + minute;

interface StarterDeed {
  lv: string;
  en: string;
  icon: string;
  points: number;
  cat: string;
  /** 0 = as often as you like. */
  maxPerDay?: number;
  /** Empty = any time of day. */
  windows?: TimeWindow[];
}

/**
 * Starter catalog so a fresh install is usable immediately. Parents can edit,
 * deactivate or delete every one of these — they are only a first draft.
 *
 * Three of them carry a time window or a daily cap. That is partly because the
 * rules genuinely fit those chores, and partly so a parent opening the editor
 * finds a worked example instead of an empty field they have to guess at.
 */
const STARTER_DEEDS: StarterDeed[] = [
  { lv: 'Nomazgāt traukus', en: 'Wash the dishes', icon: '🍽️', points: 10, cat: 'Virtuve' },
  { lv: 'Salikt traukus skapī', en: 'Put the dishes away', icon: '🥣', points: 5, cat: 'Virtuve' },
  {
    lv: 'Uzkopt savu istabu',
    en: 'Tidy my room',
    icon: '🧹',
    points: 15,
    cat: 'Mājas darbi',
    maxPerDay: 1,
  },
  { lv: 'Izsūkt putekļus', en: 'Vacuum the floor', icon: '🧽', points: 15, cat: 'Mājas darbi' },
  {
    lv: 'Salocīt un salikt drēbes',
    en: 'Fold and put away clothes',
    icon: '👕',
    points: 10,
    cat: 'Mājas darbi',
  },
  { lv: 'Iznest atkritumus', en: 'Take out the rubbish', icon: '🗑️', points: 5, cat: 'Mājas darbi' },
  {
    lv: 'Iztīrīt zobus',
    en: 'Brush my teeth',
    icon: '🪥',
    points: 5,
    cat: 'Veselība',
    maxPerDay: 2,
    windows: [
      { start_min: at(6), end_min: at(10) },
      { start_min: at(19), end_min: at(22, 30) },
    ],
  },
  {
    lv: 'Saklāt gultu',
    en: 'Make my bed',
    icon: '🛏️',
    points: 5,
    cat: 'Mājas darbi',
    maxPerDay: 1,
    windows: [{ start_min: at(6), end_min: at(11) }],
  },
  { lv: 'Pieskatīt brāli vai māsu', en: 'Look after a sibling', icon: '🧸', points: 20, cat: 'Ģimene' },
  { lv: 'Palīdzēt gatavot ēdienu', en: 'Help cook a meal', icon: '🍲', points: 15, cat: 'Virtuve' },
  { lv: 'Īpaši laipna uzvedība', en: 'Being extra polite', icon: '😊', points: 10, cat: 'Ģimene' },
  {
    lv: 'Pabeigt mājasdarbus bez atgādinājuma',
    en: 'Homework done without reminders',
    icon: '📚',
    points: 20,
    cat: 'Skola',
    maxPerDay: 1,
  },
  { lv: 'Pabarot mājdzīvnieku', en: 'Feed the pet', icon: '🐾', points: 5, cat: 'Ģimene' },
  { lv: 'Palīdzēt dārzā', en: 'Help in the garden', icon: '🌱', points: 15, cat: 'Ārā' },
];

const STARTER_REWARDS: Array<[lv: string, en: string, icon: string, cost: number, dlv: string]> = [
  ['30 min spēļu konsoles laiks', '30 min console time', '🎮', 50, 'Papildus laiks pie konsoles'],
  ['1 stunda ekrāna laika', '1 hour of screen time', '📱', 90, 'Telefons vai planšete'],
  ['Filmu vakars', 'Movie night', '🍿', 120, 'Tu izvēlies filmu'],
  ['Saldējums', 'Ice cream', '🍦', 60, 'Ceļojums uz saldējuma veikalu'],
  ['5 EUR kabatas nauda', '5 EUR pocket money', '💶', 250, 'Izmaksā skaidrā naudā'],
  ['Vēlāka gulētiešana (30 min)', 'Stay up 30 min later', '🌙', 80, 'Der tikai brīvdienās'],
  ['Izvēlēties vakariņas', 'Choose dinner', '🍕', 100, 'Tu izvēlies, ko ēdam'],
  ['Draugs ciemos pa nakti', 'Friend sleepover', '🏕️', 300, 'Jāsaskaņo datums'],
];

/** Fills the deed and reward catalogs — only when they are still empty. */
export function seedStarterCatalog(createdBy: number): void {
  const deeds = (db.prepare('SELECT COUNT(*) AS n FROM deeds').get() as { n: number }).n;
  const rewards = (db.prepare('SELECT COUNT(*) AS n FROM rewards').get() as { n: number }).n;

  const insertDeed = db.prepare(
    `INSERT INTO deeds (title_lv, title_en, icon, points, category, sort_order,
                        max_per_day, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReward = db.prepare(
    `INSERT INTO rewards (title_lv, title_en, icon, cost, description_lv, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (deeds === 0) {
      STARTER_DEEDS.forEach((deed, i) => {
        const info = insertDeed.run(
          deed.lv,
          deed.en,
          deed.icon,
          deed.points,
          deed.cat,
          i,
          deed.maxPerDay ?? 0,
          createdBy,
        );
        if (deed.windows) replaceWindows(Number(info.lastInsertRowid), deed.windows);
      });
    }
    if (rewards === 0) {
      STARTER_REWARDS.forEach(([lv, en, icon, cost, dlv], i) =>
        insertReward.run(lv, en, icon, cost, dlv, i, createdBy),
      );
    }
  })();
}
