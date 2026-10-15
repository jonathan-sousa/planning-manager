/**
 * Turns the fictional data of data.ts into validated rows with their ids:
 * every row goes through the API input schema, references are resolved.
 */
import { randomUUID } from 'node:crypto';
import {
  agentInput,
  agentRequestInput,
  coverageNeedInput,
  coverageOverrideInput,
  gradeInput,
  shiftTypeInput,
  skillInput,
} from '../../shared/schemas';
import * as data from './data';

function index<T>(rows: T[], key: (row: T) => string): (name: string) => string {
  const ids = new Map(rows.map((row) => [key(row), (row as { id: string }).id]));
  return (name) => {
    const id = ids.get(name);
    if (!id) throw new Error(`Unknown seed reference: ${name}`);
    return id;
  };
}

/** @param month current month 'YYYY-MM'; dated rows land in the next one. */
export function buildSeed(month: string) {
  const grades = data.grades.map((grade, sortOrder) => ({
    id: randomUUID(),
    ...gradeInput.parse(grade),
    sortOrder,
  }));
  const skills = data.skills.map((skill) => ({ id: randomUUID(), ...skillInput.parse(skill) }));
  const shiftTypes = data.shiftTypes.map((shift) => ({
    id: randomUUID(),
    ...shiftTypeInput.parse(shift),
  }));
  const gradeId = index(grades, (grade) => grade.code);
  const skillId = index(skills, (skill) => skill.code);
  const shiftId = index(shiftTypes, (shift) => shift.code);

  const agents = data.agents.map(({ grade, skills: codes, ...agent }) => ({
    id: randomUUID(),
    ...agentInput.parse({ ...agent, gradeId: gradeId(grade), skillIds: codes.map(skillId) }),
  }));
  const agentId = index(agents, (agent) => `${agent.firstName} ${agent.lastName}`);
  const agentSkills = agents.flatMap((agent) =>
    agent.skillIds.map((id) => ({ agentId: agent.id, skillId: id }))
  );

  const coverageNeeds = data.coverageNeeds.map(({ shift, grade, skill, ...need }) => ({
    id: randomUUID(),
    ...coverageNeedInput.parse({
      ...need,
      shiftTypeId: shiftId(shift),
      gradeId: gradeId(grade),
      skillId: skill ? skillId(skill) : null,
    }),
  }));

  const dated = data.datedRows(month);
  const coverageOverrides = dated.coverageOverrides.map(({ shift, grade, skill, ...item }) => ({
    id: randomUUID(),
    ...coverageOverrideInput.parse({
      ...item,
      shiftTypeId: shiftId(shift),
      gradeId: gradeId(grade),
      skillId: skill ? skillId(skill) : null,
    }),
  }));
  const agentRequests = dated.agentRequests.map(({ agent, shift, ...request }) => ({
    id: randomUUID(),
    ...agentRequestInput.parse({
      ...request,
      agentId: agentId(agent),
      shiftTypeId: shift ? shiftId(shift) : null,
    }),
  }));

  return {
    grades,
    skills,
    shiftTypes,
    agents: agents.map(({ skillIds: _skillIds, ...agent }) => agent),
    agentSkills,
    coverageNeeds,
    coverageOverrides,
    agentRequests,
  };
}
