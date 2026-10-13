import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addDays, monthDates } from '../../../api/calendar';
import type { PlanningStatus } from '../../../api/domain';
import { planningAgents, type RuleInput, type Violation } from '../../../api/rules/model';
import { acceptViolationInput } from '../../../api/schemas';
import { countPlanning, coverage, validatePlanning } from '../../../api/rules/validate';
import { type CoverageRow, PlanningGrid } from './planning-grid';
import { usePlanningEditor } from './use-planning-editor';
import { FormShell } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import {
  type Agent,
  type AgentRequest,
  type CoverageNeed,
  type CoverageOverride,
  type Grade,
  type MonthPlanning,
  plannings,
  type RuleSettings,
  type ShiftType,
  type Skill,
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

/** Days of the previous month shown before the grid. */
const CONTEXT_DAYS = 7;

const acceptedKey = (v: { agentId?: string; date: string; rule: string }) =>
  `${v.agentId}|${v.date}|${v.rule}`;

/** A month's grid with live validation, counters, coverage and status. */
export function PlanningEditor(props: PlanningEditorProps) {
  const { month, data, grades, skills, shifts } = props;
  const queryClient = useQueryClient();
  const { cells, apply, undo, saving } = usePlanningEditor(month, data, shifts);
  const [accepting, setAccepting] = useState<Violation | null>(null);
  const dates = useMemo(() => monthDates(month), [month]);
  const contextDates = useMemo(
    () => Array.from({ length: CONTEXT_DAYS }, (_, i) => addDays(dates[0]!, i - CONTEXT_DAYS)),
    [dates]
  );
  const status = data.planning!.status;
  const readOnly = status !== 'DRAFT';
  const reload = () => queryClient.invalidateQueries({ queryKey: plannings.query(month).queryKey });

  const setStatus = useMutation({
    mutationFn: (next: PlanningStatus) => plannings.setStatus(month, next),
    onSuccess: reload,
    onError: (error) => toast.error(error.message),
  });
  const removeAccepted = useMutation({
    mutationFn: (id: string) => plannings.removeAccepted(month, id),
    onSuccess: reload,
    onError: (error) => toast.error(error.message),
  });

  const gradeOrder = new Map(grades.map((grade) => [grade.id, grade.sortOrder]));
  const gradeCode = new Map(grades.map((grade) => [grade.id, grade.code]));
  const rows = planningAgents(props.agents, [...cells.values()], month).sort(
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
  const acceptedByKey = new Map(data.acceptedViolations.map((item) => [acceptedKey(item), item]));
  const accepted = new Set(acceptedByKey.keys());

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
  const isOpenHard = (violation: Violation) =>
    violation.severity === 'HARD' && !accepted.has(acceptedKey(violation));
  const openHard = violations.filter(isOpenHard).length;
  const acceptedCount = violations.filter(
    (violation) => violation.severity === 'HARD' && accepted.has(acceptedKey(violation))
  ).length;
  const soft = violations.filter((violation) => violation.severity === 'SOFT').length;
  const listed = [...violations].sort(
    (a, b) =>
      Number(!isOpenHard(a)) - Number(!isOpenHard(b)) ||
      Number(a.severity !== 'HARD') - Number(b.severity !== 'HARD') ||
      a.date.localeCompare(b.date)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <Button
            disabled={openHard > 0 || saving || setStatus.isPending}
            onClick={() => setStatus.mutate('VALIDATED')}
          >
            Valider le planning
          </Button>
        )}
        {status === 'VALIDATED' && (
          <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate('PUBLISHED')}>
            Publier
          </Button>
        )}
        {status !== 'DRAFT' && (
          <Button
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate('DRAFT')}
          >
            Rouvrir en brouillon
          </Button>
        )}
        <span className="text-muted-foreground text-xs">
          {readOnly
            ? 'Lecture seule : rouvrez le planning pour le modifier.'
            : openHard > 0
              ? `Validation possible une fois les ${openHard} violation(s) dure(s) corrigée(s) ou acceptée(s).`
              : saving
                ? 'Enregistrement…'
                : 'Enregistré'}
        </span>
      </div>
      {!readOnly && (
        <p className="text-muted-foreground text-xs">
          Saisie : tapez un code (J, N, CA…) ; Suppr vide ; Alt+L verrouille ; Maj+flèches
          sélectionne ; Cmd/Ctrl+C, V, Z.
        </p>
      )}

      <PlanningGrid
        contextDates={contextDates}
        dates={dates}
        agents={rows}
        gradeCode={gradeCode}
        shifts={shifts}
        cells={cells}
        violations={violations}
        accepted={accepted}
        counters={counters}
        coverage={coverageRows}
        readOnly={readOnly}
        onApply={apply}
        onUndo={undo}
      />

      <section className="space-y-2">
        <h2 className="font-medium">
          {openHard} violation(s) dure(s) à traiter, {acceptedCount} acceptée(s), {soft} souple(s)
        </h2>
        <ul className="max-h-72 space-y-1 overflow-auto text-sm">
          {listed.map((violation, index) => {
            const acceptance = acceptedByKey.get(acceptedKey(violation));
            return (
              <li key={index} className="flex flex-wrap items-center gap-x-2">
                <span
                  className={
                    isOpenHard(violation)
                      ? 'text-destructive font-medium'
                      : violation.severity === 'SOFT'
                        ? 'text-amber-600'
                        : 'text-muted-foreground'
                  }
                >
                  {formatDate(violation.date)}
                </span>
                <span>{violation.agentId ? agentName.get(violation.agentId) : 'Couverture'}</span>
                <span className="text-muted-foreground">{violation.message}</span>
                {acceptance && (
                  <span className="text-muted-foreground italic">
                    — acceptée : {acceptance.comment}
                  </span>
                )}
                {!readOnly && isOpenHard(violation) && (
                  <Button variant="link" size="xs" onClick={() => setAccepting(violation)}>
                    Accepter…
                  </Button>
                )}
                {!readOnly && acceptance && (
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => removeAccepted.mutate(acceptance.id)}
                  >
                    Retirer
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={accepting !== null} onOpenChange={(open) => !open && setAccepting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Accepter une violation</DialogTitle>
          </DialogHeader>
          {accepting && (
            <AcceptViolationForm
              month={month}
              violation={accepting}
              who={agentName.get(accepting.agentId!) ?? ''}
              onSaved={() => {
                setAccepting(null);
                void reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AcceptViolationForm({
  month,
  violation,
  who,
  onSaved,
}: {
  month: string;
  violation: Violation;
  who: string;
  onSaved: () => void;
}) {
  const form = useAppForm({
    defaultValues: {
      agentId: violation.agentId!,
      date: violation.date,
      rule: violation.rule as string,
      comment: '',
    },
    validationLogic,
    validators: {
      onDynamic: acceptViolationInput,
      onSubmitAsync: ({ value }) => submitToApi(() => plannings.acceptViolation(month, value)),
    },
    onSubmit: onSaved,
  });
  return (
    <form.AppForm>
      <p className="text-sm">
        {who}, {formatDate(violation.date)} : {violation.message}
      </p>
      <FormShell>
        <div className="sm:col-span-2">
          <form.AppField name="comment">
            {(field) => (
              <field.TextareaField
                label="Justification"
                description="Conservée avec le planning. Jamais de motif médical."
              />
            )}
          </form.AppField>
        </div>
      </FormShell>
    </form.AppForm>
  );
}
