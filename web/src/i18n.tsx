import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'lv' | 'en';

/**
 * Latvian is the source language — `en` is a translation of it, and `lv` is the
 * fallback when an English string is missing, never the other way round.
 */
const lv = {
  appName: 'Punktu sistēma',
  tagline: 'Labie darbi pārvēršas punktos',

  // nav
  navHome: 'Sākums',
  navDeeds: 'Darbi',
  navShop: 'Balvas',
  navHistory: 'Vēsture',
  navQueue: 'Jāizskata',
  navFamily: 'Ģimene',
  navSettings: 'Iestatījumi',

  // generic
  save: 'Saglabāt',
  cancel: 'Atcelt',
  delete: 'Dzēst',
  edit: 'Labot',
  add: 'Pievienot',
  close: 'Aizvērt',
  back: 'Atpakaļ',
  confirm: 'Apstiprināt',
  loading: 'Ielādē…',
  points: 'punkti',
  pointsShort: 'p',
  yes: 'Jā',
  no: 'Nē',
  optional: 'nav obligāti',
  all: 'Visi',
  active: 'Aktīvs',
  inactive: 'Neaktīvs',
  parent: 'Vecāks',
  kid: 'Bērns',

  // auth
  whoAreYou: 'Kas tu esi?',
  enterPin: 'Ievadi savu PIN',
  pin: 'PIN kods',
  newPin: 'Jaunais PIN',
  currentPin: 'Pašreizējais PIN',
  changePin: 'Nomainīt PIN',
  pinChanged: 'PIN nomainīts',
  logIn: 'Ieiet',
  logOut: 'Iziet',
  wrongPin: 'Nepareizs PIN. Mēģini vēlreiz!',
  noUsers: 'Neviens lietotājs vēl nav izveidots',
  forgotPin: 'Aizmirsi PIN?',
  forgotPinLead:
    'Nosūtīsim ziņu vecākiem, ka esi aizmirsis savu PIN. Viņi to atiestatīs un pateiks tev jauno.',
  forgotPinAdminLead:
    'Nosūtīsim ziņu administratoram, ka esi aizmirsis savu PIN. Viņš to atiestatīs un pateiks tev jauno.',
  sendRequest: 'Nosūtīt',
  pinRequestSent: 'Nosūtīts! Pajautā vecākiem jauno PIN 🔑',
  lockedOut: 'Pārāk daudz mēģinājumu. Pamēģini pēc {n} min.',

  // admin
  admin: 'Administrators',
  adminBadge: '🛡️ Administrators',
  makeAdmin: 'Padarīt par administratoru',
  makeAdminWarn:
    'Administrators kļūs {name}, un tu zaudēsi šo lomu. Tikai administrators var atiestatīt cita vecāka PIN.',
  adminTransferred: 'Administrators nomainīts',
  pinRequestsTitle: 'PIN atiestatīšanas pieprasījumi',
  pinRequestFrom: 'aizmirsa savu PIN',
  dismiss: 'Noraidīt',
  dismissed: 'Noraidīts',

  // setup
  setupTitle: 'Sveiki!',
  setupLead:
    'Izveidosim pirmo vecāka kontu. Pēc tam varēsi pievienot bērnus un pārējos ģimenes locekļus.',
  yourName: 'Tavs vārds',
  username: 'Lietotājvārds',
  usernameHint: 'Mazie burti, cipari, punkts vai domuzīme',
  pinHint: '4–10 cipari',
  createAccount: 'Izveidot kontu',

  // kid home
  myPoints: 'Mani punkti',
  pendingPoints: 'gaida apstiprinājumu',
  reservedPoints: 'rezervēti balvām',
  available: 'Pieejami',
  whatDidYouDo: 'Ko tu izdarīji?',
  pickDeed: 'Izvēlies darbu, ko esi paveicis',
  myRequests: 'Mani pieteikumi',
  noRequests: 'Vēl nav neviena pieteikuma',
  submitDeed: 'Pieteikt darbu',
  deedSubmitted: 'Pieteikts! Gaidi vecāku apstiprinājumu 🎉',
  addNote: 'Piezīme vecākiem',
  notePlaceholder: 'Piemēram: nomazgāju visus traukus un noslaucīju galdu',
  withdraw: 'Atsaukt',
  withdrawn: 'Pieteikums atsaukts',

  // shop
  shopTitle: 'Balvu veikals',
  shopLead: 'Iztērē savus punktus!',
  cost: 'Maksā',
  request: 'Pieprasīt',
  notEnough: 'Vēl nepietiek punktu',
  needMore: 'Vajag vēl {n} p',
  rewardRequested: 'Pieprasīts! Gaidi vecāku atbildi ✨',
  myWishes: 'Mani pieprasījumi',
  noRewards: 'Vēl nav neviena balva',

  // history
  historyTitle: 'Punktu vēsture',
  noHistory: 'Vēl nav neviena ieraksta',
  earned: 'Nopelnīts',
  spent: 'Iztērēts',
  adjustment: 'Korekcija',
  by: 'Piešķīra',

  // parent
  parentHome: 'Pārskats',
  waitingForYou: 'Gaida tavu lēmumu',
  nothingToReview: 'Viss izskatīts! Lieliski 👏',
  deedRequests: 'Padarītie darbi',
  rewardRequests: 'Balvu pieprasījumi',
  approve: 'Apstiprināt',
  reject: 'Noraidīt',
  approved: 'Apstiprināts',
  rejected: 'Noraidīts',
  pending: 'Gaida',
  approvedToast: 'Apstiprināts! Punkti pieskaitīti ✅',
  rejectedToast: 'Noraidīts',
  rejectReason: 'Kāpēc noraidi?',
  rejectReasonHint: 'Bērns redzēs šo piezīmi',
  thisWeek: 'Šonedēļ',
  reviewedBy: 'Izskatīja',

  // family management
  familyTitle: 'Ģimene',
  addKid: 'Pievienot bērnu',
  addParent: 'Pievienot vecāku',
  addMember: 'Pievienot ģimenes locekli',
  role: 'Loma',
  avatar: 'Attēls',
  color: 'Krāsa',
  resetPin: 'Atiestatīt PIN',
  resetPinLead: 'Iestati jaunu PIN. {name} tiks izlogots no visām ierīcēm.',
  pinReset: 'PIN atiestatīts',
  deactivate: 'Deaktivizēt',
  activate: 'Aktivizēt',
  memberAdded: 'Pievienots!',
  memberUpdated: 'Saglabāts',
  deleteMember: 'Dzēst ģimenes locekli',
  deleteMemberWarn:
    'Tiks neatgriezeniski dzēsts {name} un visa viņa punktu vēsture. To nevar atsaukt.',
  givePoints: 'Piešķirt punktus',
  takePoints: 'Atņemt punktus',
  adjustPoints: 'Koriģēt punktus',
  amount: 'Daudzums',
  reason: 'Pamatojums',
  reasonRequired: 'Pamatojums ir obligāts',
  pointsAdjusted: 'Punkti koriģēti',

  // catalog management
  manageDeeds: 'Labo darbu saraksts',
  manageRewards: 'Balvu saraksts',
  newDeed: 'Jauns labais darbs',
  newReward: 'Jauna balva',
  editDeed: 'Labot darbu',
  editReward: 'Labot balvu',
  titleLv: 'Nosaukums (latviski)',
  titleEn: 'Nosaukums (angliski)',
  icon: 'Ikona',
  iconHint: 'Izvēlies emocijzīmi vai atstāj tukšu',
  pointValue: 'Punktu vērtība',
  costValue: 'Cena punktos',
  category: 'Kategorija',
  description: 'Apraksts',
  deedSaved: 'Darbs saglabāts',
  rewardSaved: 'Balva saglabāta',
  deleteDeedWarn:
    'Darbs tiks izņemts no saraksta. Jau apstiprinātie pieteikumi un punkti paliks neskarti.',
  deleteRewardWarn:
    'Balva tiks izņemta no saraksta. Jau apstiprinātie pieprasījumi paliks neskarti.',
  showInactive: 'Rādīt neaktīvos',

  // settings
  settingsTitle: 'Iestatījumi',
  appearance: 'Izskats',
  theme: 'Tēma',
  themeLight: 'Gaišā',
  themeDark: 'Tumšā',
  themeSystem: 'Sistēmas',
  accentColor: 'Akcenta krāsa',
  language: 'Valoda',
  account: 'Konts',
  aboutApp: 'Par lietotni',
  version: 'Versija',

  // errors
  err_network_error: 'Nav savienojuma ar serveri',
  err_unauthorized: 'Lūdzu, ienāc sistēmā vēlreiz',
  err_parent_only: 'To drīkst darīt tikai vecāki',
  err_forbidden: 'Nav atļaujas',
  err_bad_credentials: 'Nepareizs PIN',
  err_username_taken: 'Šis lietotājvārds jau ir aizņemts',
  err_invalid_username: 'Lietotājvārds drīkst saturēt tikai mazos burtus, ciparus, . _ -',
  err_invalid_pin: 'PIN jābūt 4–10 cipariem',
  err_insufficient_points: 'Nepietiek punktu',
  err_already_reviewed: 'Šis pieteikums jau ir izskatīts',
  err_last_parent: 'Nevar dzēst vai deaktivizēt pēdējo vecāku',
  err_not_found: 'Nav atrasts',
  err_field_required: 'Lauks ir obligāts',
  err_field_too_long: 'Pārāk garš teksts',
  err_out_of_range: 'Skaitlis ir ārpus atļautā diapazona',
  err_invalid_field: 'Nederīga vērtība',
  err_cannot_delete_self: 'Sevi dzēst nevar',
  err_admin_only: 'To drīkst darīt tikai administrators',
  err_active_parent_required: 'Administrators var būt tikai aktīvs vecāks',
  err_too_many_attempts: 'Pārāk daudz mēģinājumu. Pamēģini pēc brīža.',
  err_invalid_json: 'Nederīgs pieprasījums',
  err_server_error: 'Radās kļūda. Mēģini vēlreiz.',
};

export type Dict = typeof lv;
export type Key = keyof Dict;

const en: Partial<Dict> = {
  appName: 'Points System',
  tagline: 'Good deeds turn into points',

  navHome: 'Home',
  navDeeds: 'Deeds',
  navShop: 'Rewards',
  navHistory: 'History',
  navQueue: 'To review',
  navFamily: 'Family',
  navSettings: 'Settings',

  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add',
  close: 'Close',
  back: 'Back',
  confirm: 'Confirm',
  loading: 'Loading…',
  points: 'points',
  pointsShort: 'p',
  yes: 'Yes',
  no: 'No',
  optional: 'optional',
  all: 'All',
  active: 'Active',
  inactive: 'Inactive',
  parent: 'Parent',
  kid: 'Kid',

  whoAreYou: 'Who are you?',
  enterPin: 'Enter your PIN',
  pin: 'PIN',
  newPin: 'New PIN',
  currentPin: 'Current PIN',
  changePin: 'Change PIN',
  pinChanged: 'PIN changed',
  logIn: 'Log in',
  logOut: 'Log out',
  wrongPin: 'Wrong PIN. Try again!',
  noUsers: 'No users created yet',
  forgotPin: 'Forgot your PIN?',
  forgotPinLead:
    "We'll let your parents know you have forgotten your PIN. They can reset it and tell you the new one.",
  forgotPinAdminLead:
    "We'll let the admin know you have forgotten your PIN. They can reset it and tell you the new one.",
  sendRequest: 'Send',
  pinRequestSent: 'Sent! Ask a parent for your new PIN 🔑',
  lockedOut: 'Too many attempts. Try again in {n} min.',

  admin: 'Admin',
  adminBadge: '🛡️ Admin',
  makeAdmin: 'Make admin',
  makeAdminWarn:
    '{name} becomes the admin and you lose the role. Only the admin can reset another parent’s PIN.',
  adminTransferred: 'Admin transferred',
  pinRequestsTitle: 'PIN reset requests',
  pinRequestFrom: 'forgot their PIN',
  dismiss: 'Dismiss',
  dismissed: 'Dismissed',

  setupTitle: 'Welcome!',
  setupLead: "Let's create the first parent account. Then you can add kids and other family members.",
  yourName: 'Your name',
  username: 'Username',
  usernameHint: 'Lowercase letters, numbers, dot or dash',
  pinHint: '4–10 digits',
  createAccount: 'Create account',

  myPoints: 'My points',
  pendingPoints: 'waiting for approval',
  reservedPoints: 'reserved for rewards',
  available: 'Available',
  whatDidYouDo: 'What did you do?',
  pickDeed: 'Pick the job you have finished',
  myRequests: 'My requests',
  noRequests: 'No requests yet',
  submitDeed: 'Submit deed',
  deedSubmitted: 'Submitted! Waiting for a parent 🎉',
  addNote: 'Note for parents',
  notePlaceholder: 'For example: washed all the dishes and wiped the table',
  withdraw: 'Withdraw',
  withdrawn: 'Request withdrawn',

  shopTitle: 'Reward shop',
  shopLead: 'Spend your points!',
  cost: 'Costs',
  request: 'Request',
  notEnough: 'Not enough points yet',
  needMore: 'Need {n} more p',
  rewardRequested: 'Requested! Waiting for a parent ✨',
  myWishes: 'My requests',
  noRewards: 'No rewards yet',

  historyTitle: 'Point history',
  noHistory: 'No entries yet',
  earned: 'Earned',
  spent: 'Spent',
  adjustment: 'Adjustment',
  by: 'Given by',

  parentHome: 'Overview',
  waitingForYou: 'Waiting for your decision',
  nothingToReview: 'All reviewed! Nice work 👏',
  deedRequests: 'Completed deeds',
  rewardRequests: 'Reward requests',
  approve: 'Approve',
  reject: 'Reject',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending',
  approvedToast: 'Approved! Points added ✅',
  rejectedToast: 'Rejected',
  rejectReason: 'Why are you rejecting?',
  rejectReasonHint: 'Your child will see this note',
  thisWeek: 'This week',
  reviewedBy: 'Reviewed by',

  familyTitle: 'Family',
  addKid: 'Add a kid',
  addParent: 'Add a parent',
  addMember: 'Add family member',
  role: 'Role',
  avatar: 'Avatar',
  color: 'Colour',
  resetPin: 'Reset PIN',
  resetPinLead: 'Set a new PIN. {name} will be logged out of every device.',
  pinReset: 'PIN reset',
  deactivate: 'Deactivate',
  activate: 'Activate',
  memberAdded: 'Added!',
  memberUpdated: 'Saved',
  deleteMember: 'Delete family member',
  deleteMemberWarn: '{name} and their entire point history will be permanently deleted. This cannot be undone.',
  givePoints: 'Give points',
  takePoints: 'Take points',
  adjustPoints: 'Adjust points',
  amount: 'Amount',
  reason: 'Reason',
  reasonRequired: 'A reason is required',
  pointsAdjusted: 'Points adjusted',

  manageDeeds: 'Good deeds',
  manageRewards: 'Rewards',
  newDeed: 'New good deed',
  newReward: 'New reward',
  editDeed: 'Edit deed',
  editReward: 'Edit reward',
  titleLv: 'Title (Latvian)',
  titleEn: 'Title (English)',
  icon: 'Icon',
  iconHint: 'Pick an emoji or leave blank',
  pointValue: 'Point value',
  costValue: 'Cost in points',
  category: 'Category',
  description: 'Description',
  deedSaved: 'Deed saved',
  rewardSaved: 'Reward saved',
  deleteDeedWarn:
    'The deed will be removed from the list. Already approved submissions and points stay untouched.',
  deleteRewardWarn: 'The reward will be removed from the list. Already approved requests stay untouched.',
  showInactive: 'Show inactive',

  settingsTitle: 'Settings',
  appearance: 'Appearance',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  accentColor: 'Accent colour',
  language: 'Language',
  account: 'Account',
  aboutApp: 'About',
  version: 'Version',

  err_network_error: 'No connection to the server',
  err_unauthorized: 'Please log in again',
  err_parent_only: 'Only parents can do that',
  err_forbidden: 'Not allowed',
  err_bad_credentials: 'Wrong PIN',
  err_username_taken: 'That username is already taken',
  err_invalid_username: 'Username may contain only lowercase letters, numbers, . _ -',
  err_invalid_pin: 'PIN must be 4–10 digits',
  err_insufficient_points: 'Not enough points',
  err_already_reviewed: 'This request has already been reviewed',
  err_last_parent: 'Cannot delete or deactivate the last parent',
  err_not_found: 'Not found',
  err_field_required: 'This field is required',
  err_field_too_long: 'Text is too long',
  err_out_of_range: 'Number is out of range',
  err_invalid_field: 'Invalid value',
  err_cannot_delete_self: 'You cannot delete yourself',
  err_admin_only: 'Only the admin can do that',
  err_active_parent_required: 'Only an active parent can be the admin',
  err_too_many_attempts: 'Too many attempts. Please try again shortly.',
  err_invalid_json: 'Invalid request',
  err_server_error: 'Something went wrong. Please try again.',
};

const DICTS: Record<Lang, Partial<Dict>> = { lv, en };

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key, filling {placeholders} from `vars`. */
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** Picks the right language column for a catalog row. */
  pick: (row: { title_lv: string; title_en: string }) => string;
}

const Ctx = createContext<I18n | null>(null);
const STORAGE_KEY = 'punkti.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'lv' || saved === 'en') return saved;
    // Latvian is the default even on an English device — this is a Latvian
    // family app first, and the switch is one tap away in Settings.
    return 'lv';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => {
      const raw = DICTS[lang][key] ?? lv[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
        name in vars ? String(vars[name]) : m,
      );
    },
    [lang],
  );

  const pick = useCallback(
    (row: { title_lv: string; title_en: string }) =>
      lang === 'en' && row.title_en ? row.title_en : row.title_lv,
    [lang],
  );

  const value = useMemo<I18n>(() => ({ lang, setLang: setLangState, t, pick }), [lang, t, pick]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Turns an API error code into a translated, human sentence. */
export function useErrorText() {
  const { t } = useI18n();
  return useCallback(
    (code: string) => {
      const key = `err_${code}` as Key;
      return key in lv ? t(key) : t('err_server_error');
    },
    [t],
  );
}
