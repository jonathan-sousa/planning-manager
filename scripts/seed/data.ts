/**
 * Fictional emergency department used to fill a development stage. Every
 * name is invented; no real person or absence reason appears here.
 * References between rows use codes and full names, resolved by build.ts.
 */
import type {
  AgentInput,
  AgentRequestInput,
  CoverageNeedInput,
  CoverageOverrideInput,
  GradeInput,
  ShiftTypeInput,
  SkillInput,
} from '../../api/schemas';

type Ref<T, K extends keyof T, R> = Omit<T, K> & R;

export const grades: GradeInput[] = [
  { code: 'IDE', label: "Infirmier diplômé d'État" },
  { code: 'AS', label: 'Aide-soignant' },
  { code: 'ASH', label: 'Agent des services hospitaliers' },
];

export const skills: SkillInput[] = [
  { code: 'IOA', label: "Infirmier organisateur de l'accueil" },
  { code: 'SAUV', label: "Salle d'accueil des urgences vitales" },
];

const work = { kind: 'WORK', archived: false } as const;
const off = { startTime: null, endTime: null, breakMinutes: 0, isNight: false, archived: false };

// 12h shifts: the 20-minute break is taken on site, so it is counted as worked.
export const shiftTypes: ShiftTypeInput[] = [
  {
    ...work,
    code: 'J',
    label: 'Jour',
    startTime: '07:00',
    endTime: '19:00',
    breakMinutes: 20,
    countedMinutes: 720,
    isNight: false,
    color: '#f59e0b',
  },
  {
    ...work,
    code: 'N',
    label: 'Nuit',
    startTime: '19:00',
    endTime: '07:00',
    breakMinutes: 20,
    countedMinutes: 720,
    isNight: true,
    color: '#4f46e5',
  },
  {
    ...work,
    code: 'M',
    label: 'Renfort matin',
    startTime: '08:00',
    endTime: '15:30',
    breakMinutes: 30,
    countedMinutes: 420,
    isNight: false,
    color: '#10b981',
  },
  {
    ...work,
    code: 'S',
    label: 'Renfort soir',
    startTime: '13:00',
    endTime: '20:30',
    breakMinutes: 30,
    countedMinutes: 420,
    isNight: false,
    color: '#06b6d4',
  },
  {
    ...off,
    kind: 'ABSENCE',
    code: 'CA',
    label: 'Congé annuel',
    countedMinutes: 420,
    color: '#a3e635',
  },
  {
    ...off,
    kind: 'ABSENCE',
    code: 'RTT',
    label: 'Réduction du temps de travail',
    countedMinutes: 420,
    color: '#84cc16',
  },
  {
    ...off,
    kind: 'ABSENCE',
    code: 'FOR',
    label: 'Formation',
    countedMinutes: 420,
    color: '#c084fc',
  },
  { ...off, kind: 'ABSENCE', code: 'ABS', label: 'Absence', countedMinutes: 420, color: '#f87171' },
  {
    ...off,
    kind: 'REST',
    code: 'RH',
    label: 'Repos hebdomadaire',
    countedMinutes: 0,
    color: '#e5e7eb',
  },
];

type SeedAgent = Ref<AgentInput, 'gradeId' | 'skillIds', { grade: string; skills: string[] }>;

const agent = (
  firstName: string,
  lastName: string,
  grade: string,
  nightMode: AgentInput['nightMode'],
  extra: Partial<SeedAgent> = {}
): SeedAgent => ({
  firstName,
  lastName,
  grade,
  skills: [],
  workTimeRatio: 100,
  nightMode,
  hoursRegime:
    nightMode === 'NIGHT_ONLY'
      ? 'NIGHT_1476'
      : nightMode === 'DAY_ONLY'
        ? 'VARIABLE_REST_1582'
        : 'MIXED_PRORATA',
  active: true,
  startDate: '2022-09-01',
  endDate: null,
  initialBalanceMinutes: 0,
  ...extra,
});

export const agents: SeedAgent[] = [
  agent('Camille', 'Arnaud', 'IDE', 'MIXED', { skills: ['IOA', 'SAUV'], startDate: '2018-03-01' }),
  agent('Nicolas', 'Bertin', 'IDE', 'MIXED', { skills: ['SAUV'], initialBalanceMinutes: 14 * 60 }),
  agent('Léa', 'Chevalier', 'IDE', 'DAY_ONLY', {
    skills: ['IOA'],
    workTimeRatio: 80,
    initialBalanceMinutes: -7 * 60,
  }),
  agent('Julien', 'Delorme', 'IDE', 'NIGHT_ONLY', { skills: ['SAUV'] }),
  agent('Sarah', 'Étienne', 'IDE', 'MIXED', { skills: ['IOA'] }),
  agent('Thomas', 'Fabre', 'IDE', 'MIXED'),
  agent('Manon', 'Garnier', 'IDE', 'NIGHT_ONLY', { skills: ['IOA'] }),
  agent('Hugo', 'Hamon', 'IDE', 'MIXED', { skills: ['SAUV'], workTimeRatio: 90 }),
  agent('Inès', 'Joly', 'IDE', 'MIXED', { startDate: '2026-01-05', endDate: '2027-12-31' }),
  agent('Lucas', 'Klein', 'IDE', 'DAY_ONLY'),
  agent('Mathis', 'Lacroix', 'IDE', 'MIXED', { skills: ['SAUV'] }),
  agent('Clara', 'Morel', 'IDE', 'MIXED', { skills: ['IOA'] }),
  agent('Raphaël', 'Navarro', 'IDE', 'NIGHT_ONLY'),
  agent('Anna', 'Pons', 'IDE', 'MIXED', { workTimeRatio: 80 }),
  agent('Chloé', 'Lemaire', 'IDE', 'MIXED', { active: false, endDate: '2026-06-30' }),
  agent('Emma', 'Marchand', 'AS', 'MIXED'),
  agent('Théo', 'Noël', 'AS', 'MIXED', { workTimeRatio: 80 }),
  agent('Zoé', 'Olivier', 'AS', 'NIGHT_ONLY'),
  agent('Louis', 'Perrin', 'AS', 'MIXED'),
  agent('Jade', 'Rey', 'AS', 'DAY_ONLY', { workTimeRatio: 50 }),
  agent('Arthur', 'Schmitt', 'AS', 'MIXED'),
  agent('Alice', 'Texier', 'AS', 'NIGHT_ONLY'),
  agent('Gabriel', 'Vidal', 'AS', 'MIXED'),
  agent('Lina', 'Roux', 'AS', 'MIXED'),
  agent('Nathan', 'Simon', 'AS', 'NIGHT_ONLY'),
  agent('Rose', 'Weber', 'ASH', 'DAY_ONLY'),
  agent('Paul', 'Xavier', 'ASH', 'DAY_ONLY'),
];

type SeedNeed = Ref<
  CoverageNeedInput,
  'shiftTypeId' | 'gradeId' | 'skillId',
  { shift: string; grade: string; skill?: string }
>;

const allDays = ['WEEKDAY', 'SATURDAY', 'SUNDAY_HOLIDAY'] as const;

// Minimums sized on the staff above: about 4 IDE and 3 AS shifts a day,
// against a capacity of ~10.6 twelve-hour shifts per full-time agent a month.
export const coverageNeeds: SeedNeed[] = [
  ...allDays.flatMap((dayKind): SeedNeed[] => [
    { dayKind, shift: 'J', grade: 'IDE', minCount: 2, targetCount: 3 },
    { dayKind, shift: 'J', grade: 'IDE', skill: 'IOA', minCount: 1, targetCount: null },
    { dayKind, shift: 'J', grade: 'AS', minCount: 2, targetCount: 3 },
    { dayKind, shift: 'N', grade: 'IDE', minCount: 2, targetCount: null },
    { dayKind, shift: 'N', grade: 'IDE', skill: 'SAUV', minCount: 1, targetCount: null },
    { dayKind, shift: 'N', grade: 'AS', minCount: 1, targetCount: 2 },
  ]),
  { dayKind: 'WEEKDAY', shift: 'J', grade: 'ASH', minCount: 1, targetCount: null },
  { dayKind: 'WEEKDAY', shift: 'M', grade: 'IDE', minCount: 0, targetCount: 1 },
  { dayKind: 'WEEKDAY', shift: 'S', grade: 'AS', minCount: 0, targetCount: 1 },
];

type SeedOverride = Ref<
  CoverageOverrideInput,
  'shiftTypeId' | 'gradeId' | 'skillId',
  { shift: string; grade: string; skill?: string }
>;

type SeedRequest = Ref<
  AgentRequestInput,
  'agentId' | 'shiftTypeId',
  { agent: string; shift?: string }
>;

/** Dated rows, placed in the month after `month` ('YYYY-MM') to stay relevant. */
export function datedRows(month: string): {
  coverageOverrides: SeedOverride[];
  agentRequests: SeedRequest[];
} {
  const [year, monthIndex] = month.split('-').map(Number);
  const next =
    monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const day = (d: number) => `${next}-${String(d).padStart(2, '0')}`;
  return {
    coverageOverrides: [
      { date: day(14), shift: 'J', grade: 'IDE', minCount: 4 },
      { date: day(14), shift: 'N', grade: 'IDE', minCount: 3 },
    ],
    agentRequests: [
      {
        agent: 'Camille Arnaud',
        startDate: day(3),
        endDate: day(9),
        kind: 'ABSENCE_APPROVED',
        shift: 'CA',
        comment: null,
      },
      {
        agent: 'Thomas Fabre',
        startDate: day(12),
        endDate: day(12),
        kind: 'WISH_OFF',
        comment: 'Anniversaire',
      },
      {
        agent: 'Emma Marchand',
        startDate: day(20),
        endDate: day(21),
        kind: 'WISH_SHIFT',
        shift: 'N',
        comment: null,
      },
      {
        agent: 'Hugo Hamon',
        startDate: day(16),
        endDate: day(17),
        kind: 'ABSENCE_APPROVED',
        shift: 'FOR',
        comment: 'Formation AFGSU',
      },
    ],
  };
}
