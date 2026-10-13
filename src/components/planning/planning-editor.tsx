import { useMemo } from 'react';
import { monthDates, monthOf } from '../../../api/calendar';
import type { RuleInput } from '../../../api/rules/model';
import { countPlanning, coverage, validatePlanning } from '../../../api/rules/validate';
import { type CoverageRow, PlanningGrid } from './planning-grid';
import { usePlanningEditor } from './use-planning-editor';
import { formatDate } from '@/lib/format';
import type {
  Agent,
  AgentRequest,
  CoverageNeed,
  CoverageOverride,
  Grade,
  MonthPlanning,
  RuleSettings,
  ShiftType,
  Skill,
} from '@/lib/resources';

interface PlanningEditorProps {
  month: string;
  data: MonthPlanning;
  agents: Agent[];
  grades: Grade[];
  skills: Skill[];
  shifts: ShiftType[];
  needs: CoverageNeed[];
  overrides: CoverageOverride[];
  requests: AgentRequest[];
  settings: RuleSettings;
}

/** A month's grid with live validation, counters and coverage. */
export function PlanningEditor(props: PlanningEditorProps) {
  const { month, data, grades, skills, shifts } = props;
  const { cells, apply, undo, saving } = usePlanningEditor(month, data, shifts);
  const dates = useMemo(() => monthDates(month), [month]);
  const readOnly = data.planning?.status !== 'DRAFT';

  // Agents under contract during the month: active ones, and inactive ones
  // that still hold cells. By grade, then name.
  const gradeOrder = new Map(grades.map((grade) => [grade.id, grade.sortOrder]));
  const gradeCode = new Map(grades.map((grade) => [grade.id, grade.code]));
  const withCells = new Set(
    [...cells.values()].filter((cell) => monthOf(cell.date) === month).map((cell) => cell.agentId)
  );
  const rows = props.agents
    .filter(
      (agent) =>
        agent.startDate <= dates.at(-1)! &&
        (!agent.endDate || agent.endDate >= dates[0]!) &&
        (agent.active || withCells.has(agent.id))
    )
    .sort(
      (a, b) =>
        (gradeOrder.get(a.gradeId) ?? 0) - (gradeOrder.get(b.gradeId) ?? 0) ||
        a.lastName.localeCompare(b.lastName, 'fr') ||
        a.firstName.localeCompare(b.firstName, 'fr')
    );

  const input: RuleInput = {
    month,
    settings: props.settings,
    agents: rows,
    shiftTypes: shifts,
    cells: [...cells.values()],
    needs: props.needs,
    overrides: props.overrides,
    requests: props.requests,
  };
  const violations = validatePlanning(input);
  const counters = new Map(countPlanning(input).map((count) => [count.agentId, count]));

  const shiftCode = new Map(shifts.map((shift) => [shift.id, shift.code]));
  const skillCode = new Map(skills.map((skill) => [skill.id, skill.code]));
  const coverageRows = [
    ...Map.groupBy(
      coverage(input),
      (slot) => `${slot.shiftTypeId}|${slot.gradeId}|${slot.skillId ?? ''}`
    ).values(),
  ]
    .map((slots): CoverageRow => {
      const { shiftTypeId, gradeId, skillId } = slots[0]!;
      return {
        label: [
          shiftCode.get(shiftTypeId),
          gradeCode.get(gradeId),
          skillId && skillCode.get(skillId),
        ]
          .filter(Boolean)
          .join(' '),
        byDate: new Map(
          slots.map((slot) => [slot.date, { count: slot.count, min: slot.minCount }])
        ),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  const agentName = new Map(
    rows.map((agent) => [agent.id, `${agent.lastName} ${agent.firstName}`])
  );
  const hard = violations.filter((violation) => violation.severity === 'HARD');
  const soft = violations.length - hard.length;
  const listed = [...violations].sort(
    (a, b) =>
      Number(a.severity !== 'HARD') - Number(b.severity !== 'HARD') || a.date.localeCompare(b.date)
  );

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>{saving ? 'Enregistrement…' : 'Enregistré'}</span>
        {readOnly && <span>Lecture seule : le planning n'est plus en brouillon.</span>}
        <span>
          Saisie : tapez un code (J, N, CA…) ; Suppr vide ; Alt+L verrouille ; Maj+flèches
          sélectionne ; Cmd/Ctrl+C, V, Z.
        </span>
      </div>
      <PlanningGrid
        dates={dates}
        agents={rows}
        gradeCode={gradeCode}
        shifts={shifts}
        cells={cells}
        violations={violations}
        counters={counters}
        coverage={coverageRows}
        readOnly={readOnly}
        onApply={apply}
        onUndo={undo}
      />
      <section className="space-y-2">
        <h2 className="font-medium">
          {hard.length} violation(s) dure(s), {soft} souple(s)
        </h2>
        <ul className="max-h-64 space-y-1 overflow-auto text-sm">
          {listed.map((violation, index) => (
            <li key={index} className="flex gap-2">
              <span
                className={
                  violation.severity === 'HARD' ? 'text-destructive font-medium' : 'text-amber-600'
                }
              >
                {formatDate(violation.date)}
              </span>
              <span>{violation.agentId ? agentName.get(violation.agentId) : 'Couverture'}</span>
              <span className="text-muted-foreground">{violation.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
