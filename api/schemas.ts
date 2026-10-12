// Input schemas of the API, also used by the frontend forms: one validation
// definition for both sides. Depends on zod only.
import { z } from 'zod';
import { DAY_KINDS, HOURS_REGIMES, NIGHT_MODES, REQUEST_KINDS, SHIFT_KINDS } from './domain';

z.config(z.locales.fr());

const code = z.string().trim().min(1).max(10);
const label = z.string().trim().min(1).max(100);
const isoDate = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:mm');
const count = z.int().min(0).max(50);
const minutes = (max: number) => z.int().min(0).max(max);
const weight = z.int().min(0).max(100);

export const idParam = z.object({ id: z.uuid() });

export const gradeInput = z.object({ code, label });

export const skillInput = z.object({ code, label });

export const agentInput = z
  .object({
    firstName: label,
    lastName: label,
    gradeId: z.uuid(),
    skillIds: z.array(z.uuid()).transform((ids) => [...new Set(ids)]),
    workTimeRatio: z.int().min(10).max(100),
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
  .superRefine((shift, ctx) => {
    const timed = shift.kind === 'WORK';
    for (const field of ['startTime', 'endTime'] as const) {
      if (timed && !shift[field]) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Requis pour un poste travaillé' });
      }
      if (!timed && shift[field]) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Réservé aux postes travaillés' });
      }
    }
  });

export const coverageNeedInput = z
  .object({
    shiftTypeId: z.uuid(),
    gradeId: z.uuid(),
    skillId: z.uuid().nullable(),
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
  shiftTypeId: z.uuid(),
  gradeId: z.uuid(),
  skillId: z.uuid().nullable(),
  minCount: count,
});

export const agentRequestInput = z
  .object({
    agentId: z.uuid(),
    startDate: isoDate,
    endDate: isoDate,
    kind: z.enum(REQUEST_KINDS),
    shiftTypeId: z.uuid().nullable(),
    comment: z.string().trim().max(500).nullable(),
  })
  .refine((request) => request.endDate >= request.startDate, {
    path: ['endDate'],
    message: 'Fin antérieure au début',
  })
  .refine((request) => (request.kind === 'WISH_SHIFT') === (request.shiftTypeId !== null), {
    path: ['shiftTypeId'],
    message: 'Poste requis pour un souhait de poste, et seulement dans ce cas',
  });

export const ruleSettingsInput = z.object({
  minDailyRestMinutes: minutes(24 * 60),
  maxShiftAmplitudeMinutes: minutes(24 * 60),
  breakThresholdMinutes: minutes(24 * 60),
  minBreakMinutes: minutes(120),
  maxWeeklyMinutes: minutes(7 * 24 * 60),
  minWeeklyRestMinutes: minutes(7 * 24 * 60),
  fortnightMinRestDays: z.int().min(0).max(14),
  fortnightAnchorDate: isoDate.refine(
    (date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1,
    'Doit être un lundi'
  ),
  maxConsecutiveWorkDays: z.int().min(1).max(14),
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
