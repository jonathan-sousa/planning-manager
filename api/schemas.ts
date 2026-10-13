// Input schemas of the API, also used by the frontend forms: one validation
// definition for both sides. Depends on zod and ./domain only.
import { z } from 'zod';
import {
  DAY_KINDS,
  HARD_RULES,
  HOURS_REGIMES,
  NIGHT_MODES,
  PLANNING_STATUSES,
  REQUEST_KINDS,
  SHIFT_KINDS,
  SOLVE_MODES,
} from './domain';

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

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isNumber = (value: unknown): value is number => Number.isInteger(value);

/**
 * Cross-field rules also run when other fields are invalid, so every error
 * shows at once; they must then tolerate malformed values (hence isText and
 * isNumber), but never a non-object body.
 */
const evenWithFieldErrors = {
  when: ({ value }: { value: unknown }) => typeof value === 'object' && value !== null,
};

/** Minutes of a 'HH:mm' time; inputs are already validated. */
const timeMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const idParam = z.object({ id: z.uuid() });

export const monthParam = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mois au format AAAA-MM'),
});

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
  .refine(
    (agent) =>
      !isText(agent.endDate) || !isText(agent.startDate) || agent.endDate >= agent.startDate,
    { path: ['endDate'], message: 'Fin antérieure au début', ...evenWithFieldErrors }
  );

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
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [field], message });
    // An invalid kind or time already has its own error.
    if (!SHIFT_KINDS.includes(shift.kind)) return;
    if (shift.kind !== 'WORK') {
      // Absences and rest days have no hours.
      if (shift.startTime) issue('startTime', 'Réservé aux postes travaillés');
      if (shift.endTime) issue('endTime', 'Réservé aux postes travaillés');
      if (shift.breakMinutes) issue('breakMinutes', 'Réservé aux postes travaillés');
      if (shift.isNight) issue('isNight', 'Réservé aux postes travaillés');
      return;
    }
    if (!shift.startTime) issue('startTime', 'Requis pour un poste travaillé');
    if (!shift.endTime) issue('endTime', 'Requis pour un poste travaillé');
    if (!time.safeParse(shift.startTime).success || !time.safeParse(shift.endTime).success) return;
    const start = timeMinutes(shift.startTime!);
    const end = timeMinutes(shift.endTime!);
    if (start === end) return issue('endTime', 'Identique au début');
    const span = end > start ? end - start : end + 24 * 60 - start;
    // Ending at 00:00 is not crossing midnight.
    if (end < start && end !== 0 && !shift.isNight) issue('isNight', 'Le poste passe minuit');
    if (isNumber(shift.breakMinutes) && shift.breakMinutes >= span) {
      issue('breakMinutes', 'La pause doit être plus courte que le poste');
    }
  }, evenWithFieldErrors);

export const coverageNeedInput = z
  .object({
    shiftTypeId: ref,
    gradeId: ref,
    skillId: ref.nullable(),
    dayKind: z.enum(DAY_KINDS),
    minCount: count,
    targetCount: count.nullable(),
  })
  .refine(
    (need) =>
      !isNumber(need.targetCount) || !isNumber(need.minCount) || need.targetCount >= need.minCount,
    { path: ['targetCount'], message: 'Cible inférieure au minimum', ...evenWithFieldErrors }
  );

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
  .refine(
    (request) =>
      !isText(request.endDate) ||
      !isText(request.startDate) ||
      request.endDate >= request.startDate,
    { path: ['endDate'], message: 'Fin antérieure au début', ...evenWithFieldErrors }
  )
  // An approved absence locks the cell with its absence code; a shift wish
  // names the shift; a day-off wish has none.
  .refine(
    (request) =>
      !REQUEST_KINDS.includes(request.kind) ||
      (request.kind === 'WISH_OFF') === (request.shiftTypeId === null),
    {
      path: ['shiftTypeId'],
      message: 'Requis, sauf pour un souhait de repos',
      ...evenWithFieldErrors,
    }
  );

/** Desired state of grid cells; `shiftTypeId: null` empties the cell. */
export const cellsInput = z.object({
  /** Planning version the edit is based on (optimistic concurrency). */
  version: integer().min(0),
  cells: z
    .array(
      z.object({
        agentId: ref,
        date: isoDate,
        shiftTypeId: ref.nullable(),
        locked: z.boolean(),
      })
    )
    .min(1)
    .max(500),
});

export const solveInput = z.object({ mode: z.enum(SOLVE_MODES) });

export const statusInput = z.object({ status: z.enum(PLANNING_STATUSES) });

/** A hard violation kept on purpose: the justification is required. */
export const acceptViolationInput = z.object({
  agentId: ref,
  date: isoDate,
  rule: z.enum(HARD_RULES as [string, ...string[]]),
  comment: z.string().trim().min(3, 'Justification requise').max(500),
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
export type CellsInput = z.input<typeof cellsInput>;
export type AcceptViolationInput = z.input<typeof acceptViolationInput>;
export type RuleSettingsInput = z.input<typeof ruleSettingsInput>;
