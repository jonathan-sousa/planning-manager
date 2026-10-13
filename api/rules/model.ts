// Input and output of the planning rules. Structural types: the API rows and
// their JSON form (frontend) both fit, so the same validator runs on both sides.
import type { DayKind, HoursRegime, NightMode, RequestKind, ShiftKind } from '../domain';

export interface RuleShift {
  id: string;
  code: string;
  kind: ShiftKind;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  countedMinutes: number;
  isNight: boolean;
}

export interface RuleAgent {
  id: string;
  firstName: string;
  lastName: string;
  gradeId: string;
  skillIds: string[];
  workTimeRatio: number;
  nightMode: NightMode;
  hoursRegime: HoursRegime;
  startDate: string;
  endDate: string | null;
}

export interface RuleCell {
  agentId: string;
  date: string;
  shiftTypeId: string;
  countedMinutes: number;
}

export interface RuleNeed {
  shiftTypeId: string;
  gradeId: string;
  skillId: string | null;
  dayKind: DayKind;
  minCount: number;
}

export interface RuleOverride {
  date: string;
  shiftTypeId: string;
  gradeId: string;
  skillId: string | null;
  minCount: number;
}

export interface RuleRequest {
  agentId: string;
  startDate: string;
  endDate: string;
  kind: RequestKind;
  shiftTypeId: string | null;
}

export interface RuleSettings {
  minDailyRestMinutes: number;
  maxShiftAmplitudeMinutes: number;
  breakThresholdMinutes: number;
  minBreakMinutes: number;
  maxWeeklyMinutes: number;
  minWeeklyRestMinutes: number;
  fortnightMinRestDays: number;
  fortnightAnchorDate: string;
  maxConsecutiveWorkDays: number;
  restDayExcludesPreviousNight: boolean;
  monthlyHoursToleranceMinutes: number;
}

export interface RuleInput {
  /** 'YYYY-MM': violations are reported for this month only. */
  month: string;
  settings: RuleSettings;
  agents: RuleAgent[];
  shiftTypes: RuleShift[];
  /** Cells of the month and of the days around it (context). */
  cells: RuleCell[];
  needs: RuleNeed[];
  overrides: RuleOverride[];
  requests: RuleRequest[];
}

export const RULES = {
  APPROVED_ABSENCE: 'HARD',
  DAILY_REST: 'HARD',
  SHIFT_AMPLITUDE: 'HARD',
  SHIFT_BREAK: 'HARD',
  WEEKLY_HOURS: 'HARD',
  WEEKLY_REST: 'HARD',
  FORTNIGHT_REST: 'HARD',
  CONSECUTIVE_DAYS: 'HARD',
  NIGHT_MODE: 'HARD',
  COVERAGE: 'SOFT',
  MONTHLY_HOURS: 'SOFT',
  WISH: 'SOFT',
  ISOLATED_REST: 'SOFT',
} as const;

export type RuleCode = keyof typeof RULES;
export type Severity = (typeof RULES)[RuleCode];

export interface Violation {
  rule: RuleCode;
  severity: Severity;
  /** Day the violation is shown on (a day of the month). */
  date: string;
  /** Absent for coverage, which concerns a day rather than an agent. */
  agentId?: string;
  message: string;
}

export interface AgentCounters {
  agentId: string;
  /** Counted minutes of work shifts. */
  workedMinutes: number;
  /** Work plus credited absences. */
  creditedMinutes: number;
  targetMinutes: number;
  nights: number;
  weekendDays: number;
  holidays: number;
}
