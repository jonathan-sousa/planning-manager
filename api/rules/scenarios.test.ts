// Replays the shared scenarios of fixtures/rule-scenarios/ (also used by the
// solver tests): names and codes in the JSON are turned into ids here.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RuleInput, RuleSettings, RuleShift } from './model';
import { validatePlanning } from './validate';

const dir = 'fixtures/rule-scenarios';
const read = <T>(file: string): T => JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as T;

interface Scenario {
  description: string;
  month: string;
  settings?: Partial<RuleSettings>;
  agents: Array<{
    name: string;
    grade?: string;
    skills?: string[];
    nightMode?: RuleInput['agents'][number]['nightMode'];
  }>;
  cells: Record<string, Record<string, string>>;
  needs?: Array<{
    shift: string;
    grade: string;
    skill?: string;
    dayKind: string;
    minCount: number;
  }>;
  overrides?: Array<{
    date: string;
    shift: string;
    grade: string;
    skill?: string;
    minCount: number;
  }>;
  requests?: Array<{
    agent: string;
    startDate: string;
    endDate: string;
    kind: RuleInput['requests'][number]['kind'];
    shift?: string;
  }>;
  rules: string[];
  expected: Array<{ rule: string; agent?: string; date: string }>;
}

const shifts = read<Omit<RuleShift, 'id'>[]>('_shifts.json').map((shift) => ({
  ...shift,
  id: shift.code,
}));
const settings = read<RuleSettings>('_settings.json');

function toInput(scenario: Scenario): RuleInput {
  const shiftId = (code: string) => {
    if (!shifts.some((shift) => shift.code === code)) throw new Error(`Unknown shift ${code}`);
    return code;
  };
  return {
    month: scenario.month,
    settings: { ...settings, ...scenario.settings },
    shiftTypes: shifts,
    agents: scenario.agents.map((agent) => ({
      id: agent.name,
      firstName: agent.name,
      lastName: '',
      gradeId: agent.grade ?? 'IDE',
      skillIds: agent.skills ?? [],
      workTimeRatio: 100,
      nightMode: agent.nightMode ?? 'MIXED',
      hoursRegime: 'MIXED_PRORATA',
      startDate: '2020-01-01',
      endDate: null,
    })),
    cells: Object.entries(scenario.cells).flatMap(([agentId, days]) =>
      Object.entries(days).map(([date, code]) => ({
        agentId,
        date,
        shiftTypeId: shiftId(code),
        countedMinutes: shifts.find((shift) => shift.code === code)!.countedMinutes,
      }))
    ),
    needs: (scenario.needs ?? []).map(({ shift, grade, skill, dayKind, minCount }) => ({
      shiftTypeId: shiftId(shift),
      gradeId: grade,
      skillId: skill ?? null,
      dayKind: dayKind as RuleInput['needs'][number]['dayKind'],
      minCount,
    })),
    overrides: (scenario.overrides ?? []).map(({ shift, grade, skill, ...rest }) => ({
      ...rest,
      shiftTypeId: shiftId(shift),
      gradeId: grade,
      skillId: skill ?? null,
    })),
    requests: (scenario.requests ?? []).map(({ agent, shift, ...rest }) => ({
      ...rest,
      agentId: agent,
      shiftTypeId: shift ? shiftId(shift) : null,
    })),
  };
}

const key = (v: { rule: string; agent?: string; date: string }) =>
  `${v.date} ${v.rule} ${v.agent ?? '-'}`;

describe('rule scenarios', () => {
  const files = readdirSync(dir).filter((file) => file.endsWith('.json') && !file.startsWith('_'));
  it.each(files)('%s', (file) => {
    const scenario = read<Scenario>(file);
    const found = validatePlanning(toInput(scenario))
      .filter((violation) => scenario.rules.includes(violation.rule))
      .map((violation) => key({ ...violation, agent: violation.agentId }))
      .sort();
    expect(found, scenario.description).toEqual(scenario.expected.map(key).sort());
  });
});
