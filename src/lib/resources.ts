import { type QueryClient, queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import type { PlanningStatus, SolveMode } from '../../shared/domain';
import type {
  AcceptViolationInput,
  AccountInput,
  AccountUpdateInput,
  AgentInput,
  AgentRequestInput,
  CellsInput,
  CoverageNeedInput,
  CoverageOverrideInput,
  GradeInput,
  RuleSettingsInput,
  ShiftTypeInput,
  SkillInput,
} from '../../shared/schemas';
import { api, expectOk, unwrap } from './api-client';

/** Database and solver check of the home page. */
export const health = {
  query: queryOptions({ queryKey: ['health'], queryFn: () => api.health.$get().then(unwrap) }),
};

/** The form input of a row: the row without its id and timestamps. */
export function omitMeta<Row extends { id: string; createdAt?: string; updatedAt: string }>(
  row: Row
): Omit<Row, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = row;
  return input;
}

export const grades = {
  query: queryOptions({ queryKey: ['grades'], queryFn: () => api.grades.$get().then(unwrap) }),
  create: (json: GradeInput) => api.grades.$post({ json }).then(unwrap),
  update: (id: string, json: GradeInput) =>
    api.grades[':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api.grades[':id'].$delete({ param: { id } }).then(expectOk),
};

export const skills = {
  query: queryOptions({ queryKey: ['skills'], queryFn: () => api.skills.$get().then(unwrap) }),
  create: (json: SkillInput) => api.skills.$post({ json }).then(unwrap),
  update: (id: string, json: SkillInput) =>
    api.skills[':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api.skills[':id'].$delete({ param: { id } }).then(expectOk),
};

export const agents = {
  query: queryOptions({ queryKey: ['agents'], queryFn: () => api.agents.$get().then(unwrap) }),
  create: (json: AgentInput) => api.agents.$post({ json }).then(unwrap),
  update: (id: string, json: AgentInput) =>
    api.agents[':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api.agents[':id'].$delete({ param: { id } }).then(expectOk),
};

export const shiftTypes = {
  query: queryOptions({
    queryKey: ['shift-types'],
    queryFn: () => api['shift-types'].$get().then(unwrap),
  }),
  create: (json: ShiftTypeInput) => api['shift-types'].$post({ json }).then(unwrap),
  update: (id: string, json: ShiftTypeInput) =>
    api['shift-types'][':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api['shift-types'][':id'].$delete({ param: { id } }).then(expectOk),
};

export const coverageNeeds = {
  query: queryOptions({
    queryKey: ['coverage-needs'],
    queryFn: () => api['coverage-needs'].$get().then(unwrap),
  }),
  create: (json: CoverageNeedInput) => api['coverage-needs'].$post({ json }).then(unwrap),
  update: (id: string, json: CoverageNeedInput) =>
    api['coverage-needs'][':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api['coverage-needs'][':id'].$delete({ param: { id } }).then(expectOk),
};

export const coverageOverrides = {
  query: queryOptions({
    queryKey: ['coverage-overrides'],
    queryFn: () => api['coverage-overrides'].$get().then(unwrap),
  }),
  create: (json: CoverageOverrideInput) => api['coverage-overrides'].$post({ json }).then(unwrap),
  update: (id: string, json: CoverageOverrideInput) =>
    api['coverage-overrides'][':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) =>
    api['coverage-overrides'][':id'].$delete({ param: { id } }).then(expectOk),
};

export const agentRequests = {
  query: queryOptions({
    queryKey: ['agent-requests'],
    queryFn: () => api['agent-requests'].$get().then(unwrap),
  }),
  create: (json: AgentRequestInput) => api['agent-requests'].$post({ json }).then(unwrap),
  update: (id: string, json: AgentRequestInput) =>
    api['agent-requests'][':id'].$put({ param: { id }, json }).then(unwrap),
  remove: (id: string) => api['agent-requests'][':id'].$delete({ param: { id } }).then(expectOk),
};

export const accounts = {
  query: queryOptions({ queryKey: ['accounts'], queryFn: () => api.accounts.$get().then(unwrap) }),
  invite: (json: AccountInput) => api.accounts.$post({ json }).then(unwrap),
  update: (username: string, json: AccountUpdateInput) =>
    api.accounts[':username'].$put({ param: { username }, json }).then(expectOk),
  resend: (username: string) =>
    api.accounts[':username'].resend.$post({ param: { username } }).then(expectOk),
  resetMfa: (username: string) =>
    api.accounts[':username']['reset-mfa'].$post({ param: { username } }).then(expectOk),
  setEnabled: (username: string, enabled: boolean) =>
    api.accounts[':username'][enabled ? 'enable' : 'disable']
      .$post({ param: { username } })
      .then(expectOk),
};

export const ruleSettings = {
  query: queryOptions({
    queryKey: ['rule-settings'],
    queryFn: () => api['rule-settings'].$get().then(unwrap),
  }),
  update: (json: RuleSettingsInput) => api['rule-settings'].$put({ json }).then(unwrap),
};

export const plannings = {
  query: (month: string) =>
    queryOptions({
      queryKey: ['plannings', month],
      queryFn: () => api.plannings[':month'].$get({ param: { month } }).then(unwrap),
    }),
  create: (month: string) => api.plannings[':month'].$post({ param: { month } }).then(unwrap),
  writeCells: (month: string, json: CellsInput) =>
    api.plannings[':month'].cells.$put({ param: { month }, json }).then(unwrap),
  setStatus: (month: string, status: PlanningStatus) =>
    api.plannings[':month'].status.$put({ param: { month }, json: { status } }).then(unwrap),
  acceptViolation: (month: string, json: AcceptViolationInput) =>
    api.plannings[':month']['accepted-violations'].$post({ param: { month }, json }).then(unwrap),
  solve: (month: string, mode: SolveMode) =>
    api.plannings[':month']['solve-runs'].$post({ param: { month }, json: { mode } }).then(unwrap),
  solveRun: (month: string, id: string) =>
    queryOptions({
      queryKey: ['solve-runs', id],
      queryFn: () =>
        api.plannings[':month']['solve-runs'][':id'].$get({ param: { month, id } }).then(unwrap),
    }),
  applySolveRun: (month: string, id: string) =>
    api.plannings[':month']['solve-runs'][':id'].apply.$post({ param: { month, id } }).then(unwrap),
  removeAccepted: (month: string, id: string) =>
    api.plannings[':month']['accepted-violations'][':id']
      .$delete({ param: { month, id } })
      .then(expectOk),
};

/** Reloads a month: its cells, status, acceptances and balances. */
export const invalidatePlanning = (queryClient: QueryClient, month: string) =>
  queryClient.invalidateQueries({ queryKey: plannings.query(month).queryKey });

export type Grade = InferResponseType<typeof api.grades.$get, 200>[number];
export type Skill = InferResponseType<typeof api.skills.$get, 200>[number];
export type Agent = InferResponseType<typeof api.agents.$get, 200>[number];
export type ShiftType = InferResponseType<(typeof api)['shift-types']['$get'], 200>[number];
export type CoverageNeed = InferResponseType<(typeof api)['coverage-needs']['$get'], 200>[number];
export type CoverageOverride = InferResponseType<
  (typeof api)['coverage-overrides']['$get'],
  200
>[number];
export type AgentRequest = InferResponseType<(typeof api)['agent-requests']['$get'], 200>[number];
export type RuleSettings = InferResponseType<(typeof api)['rule-settings']['$get'], 200>;
export type Account = InferResponseType<typeof api.accounts.$get, 200>[number];
export type MonthPlanning = InferResponseType<(typeof api)['plannings'][':month']['$get'], 200>;
export type Assignment = MonthPlanning['assignments'][number];
export type AcceptedViolation = MonthPlanning['acceptedViolations'][number];
