import { db } from './db.ts';

/**
 * Starter catalog so a fresh install is usable immediately. Parents can edit,
 * deactivate or delete every one of these — they are only a first draft.
 */
const STARTER_DEEDS: Array<[lv: string, en: string, icon: string, points: number, cat: string]> = [
  ['Nomazgāt traukus', 'Wash the dishes', '🍽️', 10, 'Virtuve'],
  ['Salikt traukus skapī', 'Put the dishes away', '🥣', 5, 'Virtuve'],
  ['Uzkopt savu istabu', 'Tidy my room', '🧹', 15, 'Mājas darbi'],
  ['Izsūkt putekļus', 'Vacuum the floor', '🧽', 15, 'Mājas darbi'],
  ['Salocīt un salikt drēbes', 'Fold and put away clothes', '👕', 10, 'Mājas darbi'],
  ['Iznest atkritumus', 'Take out the rubbish', '🗑️', 5, 'Mājas darbi'],
  ['Pieskatīt brāli vai māsu', 'Look after a sibling', '🧸', 20, 'Ģimene'],
  ['Palīdzēt gatavot ēdienu', 'Help cook a meal', '🍲', 15, 'Virtuve'],
  ['Īpaši laipna uzvedība', 'Being extra polite', '😊', 10, 'Ģimene'],
  ['Pabeigt mājasdarbus bez atgādinājuma', 'Homework done without reminders', '📚', 20, 'Skola'],
  ['Pabarot mājdzīvnieku', 'Feed the pet', '🐾', 5, 'Ģimene'],
  ['Palīdzēt dārzā', 'Help in the garden', '🌱', 15, 'Ārā'],
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
    `INSERT INTO deeds (title_lv, title_en, icon, points, category, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReward = db.prepare(
    `INSERT INTO rewards (title_lv, title_en, icon, cost, description_lv, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (deeds === 0) {
      STARTER_DEEDS.forEach(([lv, en, icon, points, cat], i) =>
        insertDeed.run(lv, en, icon, points, cat, i, createdBy),
      );
    }
    if (rewards === 0) {
      STARTER_REWARDS.forEach(([lv, en, icon, cost, dlv], i) =>
        insertReward.run(lv, en, icon, cost, dlv, i, createdBy),
      );
    }
  })();
}
