// Input schemas of the API, also used by the frontend forms: one validation
// definition for both sides. Depends on zod only.
import { z } from 'zod';
import { DAY_KINDS, HOURS_REGIMES, NIGHT_MODES, REQUEST_KINDS, SHIFT_KINDS } from './domain';

z.config(z.locales.fr());

const code = z.string().trim().min(1, 'Requis').max(10);
const label = z.string().trim().min(1, 'Requis').max(100);
const isoDate = z.iso.date({ error: 'Date requise' });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:mm');
const integer = () => z.int({ error: 'Nombre entier requis' });
const count = integer().min(0).max(50);
const minutes = (max: number) => z.int({ error: 'Durée requise' }).min(0).max(max);
const weight = integer().min(0).max(100);
/** Reference to another row, chosen in a select. */
const ref = z.uuid({ error: 'Choix requis' });

export const idParam = z.object({ id: z.uuid() });

export const gradeInput = z.object({ code, label });

export const skillInput = z.object({ code, label });

export const agentInput = z
  .object({
    firstName: label,
    lastName: label,
    gradeId: ref,
    skillIds: z.array(ref).transform((ids) => [...new Set(ids)]),
    workTimeRatio: integer().min(10).max(100),
    nightMode: z.enum(NIGHT_MODES),
    hoursRegime: z.enum(HOURS_REGIMES),
    active: z.boolean(),
    startDate: isoDate,
    endDate: isoDate.nullable(),
  })
  .refine((agent) => !agent.endDate || agent.endDate >= agent.startDate, {
    path: ['endDate'],
    message: 'Fin antérieure au début',
  });

export const shiftTypeInput = z
  .object({
    code,
    label,
    kind: z.enum(SHIFT_KINDS),
    startTime: time.nullable(),
    endTime: time.nullable(),
    breakMinutes: minutes(240),
    countedMinutes: minutes(24 * 60),
    isNight: z.boolean(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Couleur au format #rrggbb'),
    archived: z.boolean(),
  })
  .superRefine(
    (shift, ctx) => {
      const timed = shift.kind === 'WORK';
      for (const field of ['startTime', 'endTime'] as const) {
        if (timed && !shift[field]) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Requis pour un poste travaillé',
          });
        }
        if (!timed && shift[field]) {
          ctx.addIssue({ code: 'custom', path: [field], message: 'Réservé aux postes travaillés' });
        }
      }
      // Also when other fields are invalid, so that every error shows at once.
    },
    { when: () => true }
  );

export const coverageNeedInput = z
  .object({
    shiftTypeId: ref,
    gradeId: ref,
    skillId: ref.nullable(),
    dayKind: z.enum(DAY_KINDS),
    minCount: count,
    targetCount: count.nullable(),
  })
  .refine((need) => need.targetCount === null || need.targetCount >= need.minCount, {
    path: ['targetCount'],
    message: 'Cible inférieure au minimum',
  });

export const coverageOverrideInput = z.object({
  date: isoDate,
  shiftTypeId: ref,
  gradeId: ref,
  skillId: ref.nullable(),
  minCount: count,
});

export const agentRequestInput = z
  .object({
    agentId: ref,
    startDate: isoDate,
    endDate: isoDate,
    kind: z.enum(REQUEST_KINDS),
    shiftTypeId: ref.nullable(),
    comment: z.string().trim().max(500).nullable(),
  })
  .refine((request) => request.endDate >= request.startDate, {
    path: ['endDate'],
    message: 'Fin antérieure au début',
  })
  // An approved absence locks the cell with its absence code; a shift wish
  // names the shift; a day-off wish has none.
  .refine((request) => (request.kind === 'WISH_OFF') === (request.shiftTypeId === null), {
    path: ['shiftTypeId'],
    message: 'Requis, sauf pour un souhait de repos',
  });

export const ruleSettingsInput = z.object({
  minDailyRestMinutes: minutes(24 * 60),
  maxShiftAmplitudeMinutes: minutes(24 * 60),
  breakThresholdMinutes: minutes(24 * 60),
  minBreakMinutes: minutes(120),
  maxWeeklyMinutes: minutes(7 * 24 * 60),
  minWeeklyRestMinutes: minutes(7 * 24 * 60),
  fortnightMinRestDays: integer().min(0).max(14),
  fortnightAnchorDate: isoDate.refine(
    (date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1,
    'Doit être un lundi'
  ),
  maxConsecutiveWorkDays: integer().min(1).max(14),
  restDayExcludesPreviousNight: z.boolean(),
  monthlyHoursToleranceMinutes: minutes(100 * 60),
  hoursDeviationWeight: weight,
  wishWeight: weight,
  weekendFairnessWeight: weight,
  nightFairnessWeight: weight,
  holidayFairnessWeight: weight,
  isolatedRestDayWeight: weight,
  stabilityWeight: weight,
});

export type GradeInput = z.input<typeof gradeInput>;
export type SkillInput = z.input<typeof skillInput>;
export type AgentInput = z.input<typeof agentInput>;
export type ShiftTypeInput = z.input<typeof shiftTypeInput>;
export type CoverageNeedInput = z.input<typeof coverageNeedInput>;
export type CoverageOverrideInput = z.input<typeof coverageOverrideInput>;
export type AgentRequestInput = z.input<typeof agentRequestInput>;
export type RuleSettingsInput = z.input<typeof ruleSettingsInput>;
