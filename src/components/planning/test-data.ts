// A small fictional month for the planning tests.
import type { GridCell } from './cells';
import type { PlanningData } from './planning-model';
import type { Agent, Grade, RuleSettings, ShiftType } from '@/lib/resources';

const timestamps = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };

export const grade = (id: string, code: string, sortOrder: number): Grade => ({
  id,
  code,
  label: code,
  sortOrder,
  ...timestamps,
});

export const agent = (id: string, lastName: string, firstName: string, gradeId = 'ide'): Agent => ({
  id,
  lastName,
  firstName,
  gradeId,
  skillIds: [],
  workTimeRatio: 100,
  nightMode: 'MIXED',
  hoursRegime: 'STANDARD_1607',
  active: true,
  startDate: '2020-01-01',
  endDate: null,
  initialBalanceMinutes: 0,
  ...timestamps,
});

export const shift = (id: string, code: string, fields: Partial<ShiftType> = {}): ShiftType => ({
  id,
  code,
  label: code,
  kind: 'WORK',
  startTime: '07:00',
  endTime: '19:00',
  breakMinutes: 20,
  countedMinutes: 720,
  isNight: false,
  color: '#f59e0b',
  archived: false,
  ...timestamps,
  ...fields,
});

export const settings = {
  id: 'default',
  minDailyRestMinutes: 720,
  maxShiftAmplitudeMinutes: 720,
  breakThresholdMinutes: 360,
  minBreakMinutes: 20,
  maxWeeklyMinutes: 2880,
  minWeeklyRestMinutes: 2160,
  fortnightMinRestDays: 4,
  fortnightAnchorDate: '2026-01-05',
  maxConsecutiveWorkDays: 5,
  restDayExcludesPreviousNight: true,
  monthlyHoursToleranceMinutes: 720,
  hoursDeviationWeight: 10,
  wishWeight: 5,
  weekendFairnessWeight: 3,
  nightFairnessWeight: 3,
  holidayFairnessWeight: 3,
  isolatedRestDayWeight: 2,
  stabilityWeight: 1,
  updatedAt: timestamps.updatedAt,
} satisfies RuleSettings;

export const gridCell = (agentId: string, date: string, shiftTypeId: string): GridCell => ({
  agentId,
  date,
  shiftTypeId,
  countedMinutes: 720,
  locked: false,
});

export const cellsOf = (...cells: GridCell[]) =>
  new Map(cells.map((cell) => [`${cell.agentId}|${cell.date}`, cell]));

export const monthData = (fields: Partial<PlanningData> = {}): PlanningData => ({
  month: '2026-11',
  agents: [],
  grades: [grade('ide', 'IDE', 0), grade('as', 'AS', 1)],
  skills: [],
  shifts: [shift('j', 'J')],
  needs: [],
  overrides: [],
  requests: [],
  settings,
  acceptedViolations: [],
  openingBalances: [],
  ...fields,
});
