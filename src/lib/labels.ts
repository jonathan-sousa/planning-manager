import type {
  DayKind,
  HoursRegime,
  NightMode,
  PlanningStatus,
  RequestKind,
  ShiftKind,
} from '../../shared/domain';

export const nightModeLabels: Record<NightMode, string> = {
  DAY_ONLY: 'Jour uniquement',
  NIGHT_ONLY: 'Nuit uniquement',
  MIXED: 'Alternant',
};

export const hoursRegimeLabels: Record<HoursRegime, string> = {
  STANDARD_1607: 'Standard (1 607 h)',
  VARIABLE_REST_1582: 'Repos variables (1 582 h)',
  NIGHT_1476: 'Nuit exclusive (1 476 h)',
  MIXED_PRORATA: 'Mixte (au prorata)',
};

export const shiftKindLabels: Record<ShiftKind, string> = {
  WORK: 'Travail',
  ABSENCE: 'Absence',
  REST: 'Repos',
};

export const dayKindLabels: Record<DayKind, string> = {
  WEEKDAY: 'Semaine',
  SATURDAY: 'Samedi',
  SUNDAY_HOLIDAY: 'Dimanche et férié',
};

export const requestKindLabels: Record<RequestKind, string> = {
  ABSENCE_APPROVED: 'Absence validée',
  WISH_OFF: 'Souhait de repos',
  WISH_SHIFT: 'Souhait de poste',
};

export const planningStatusLabels: Record<PlanningStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  PUBLISHED: 'Publié',
};

/** Select options from a label map. */
export const optionsOf = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
