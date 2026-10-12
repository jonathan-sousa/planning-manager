import { useQuery } from '@tanstack/react-query';
import { agents, grades, shiftTypes, skills } from './resources';

/**
 * Reference lists for tables (code by id) and form selects. Archived shift
 * types and inactive agents are offered only when already selected (`keep`).
 */
export function useReferences(keep: { shiftTypeId?: string | null; agentId?: string } = {}) {
  const gradeList = useQuery(grades.query).data ?? [];
  const skillList = useQuery(skills.query).data ?? [];
  const shiftList = useQuery(shiftTypes.query).data ?? [];
  const agentList = useQuery(agents.query).data ?? [];

  return {
    gradeCode: new Map(gradeList.map((grade) => [grade.id, grade.code])),
    gradeOrder: new Map(
      gradeList.map((grade) => [grade.id, String(grade.sortOrder).padStart(3, '0')])
    ),
    skillCode: new Map(skillList.map((skill) => [skill.id, skill.code])),
    shiftCode: new Map(shiftList.map((shift) => [shift.id, shift.code])),
    agentName: new Map(
      agentList.map((agent) => [agent.id, `${agent.lastName} ${agent.firstName}`])
    ),
    gradeOptions: gradeList.map((grade) => ({ value: grade.id, label: grade.code })),
    skillOptions: skillList.map((skill) => ({ value: skill.id, label: skill.code })),
    shiftOptions: shiftList
      .filter((shift) => !shift.archived || shift.id === keep.shiftTypeId)
      .map((shift) => ({ value: shift.id, label: `${shift.code} — ${shift.label}` })),
    workShiftOptions: shiftList
      .filter(
        (shift) => shift.kind === 'WORK' && (!shift.archived || shift.id === keep.shiftTypeId)
      )
      .map((shift) => ({ value: shift.id, label: `${shift.code} — ${shift.label}` })),
    absenceOptions: shiftList
      .filter(
        (shift) => shift.kind !== 'WORK' && (!shift.archived || shift.id === keep.shiftTypeId)
      )
      .map((shift) => ({ value: shift.id, label: `${shift.code} — ${shift.label}` })),
    agentOptions: agentList
      .filter((agent) => agent.active || agent.id === keep.agentId)
      .map((agent) => ({ value: agent.id, label: `${agent.lastName} ${agent.firstName}` })),
  };
}
