import { violationKey, type Violation } from '../../../shared/rules/model';
import { acceptViolationInput } from '../../../shared/schemas';
import type { CoverageSlot, PlanningModel } from './planning-model';
import { FormShell } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import { plannings } from '@/lib/resources';

/** Violations of the month, open hard ones first, with their acceptances. */
export function ViolationList({
  model,
  readOnly,
  onDiagnose,
  onAccept,
  onRemove,
}: {
  model: Pick<PlanningModel, 'summary' | 'acceptedByKey' | 'slotLabel' | 'agentName'>;
  readOnly: boolean;
  onDiagnose: (slot: CoverageSlot, date: string) => void;
  onAccept: (violation: Violation) => void;
  /** Withdraws an acceptance. */
  onRemove: (id: string) => void;
}) {
  const { acceptedByKey, slotLabel, agentName } = model;
  const { isOpenHard, openHard, listed } = model.summary;
  return (
    <section className="space-y-2">
      <h2 className="font-medium">
        {openHard} violation(s) dure(s) à traiter, {model.summary.accepted} acceptée(s),{' '}
        {model.summary.soft} souple(s)
      </h2>
      <ul className="max-h-72 space-y-1 overflow-auto text-sm">
        {listed.map((violation, index) => {
          const acceptance = acceptedByKey.get(violationKey(violation));
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
              <span>
                {violation.slot
                  ? `Couverture ${slotLabel(violation.slot)}`
                  : agentName.get(violation.agentId!)}
              </span>
              <span className="text-muted-foreground">{violation.message}</span>
              {acceptance && (
                <span className="text-muted-foreground italic">
                  — acceptée : {acceptance.comment}
                </span>
              )}
              {violation.slot && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => onDiagnose(violation.slot!, violation.date)}
                >
                  Pourquoi ?
                </Button>
              )}
              {!readOnly && isOpenHard(violation) && (
                <Button variant="link" size="xs" onClick={() => onAccept(violation)}>
                  Accepter…
                </Button>
              )}
              {!readOnly && acceptance && (
                <Button variant="link" size="xs" onClick={() => onRemove(acceptance.id)}>
                  Retirer
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Keeps a hard violation, with the justification required to validate the month. */
export function AcceptViolationDialog({
  month,
  violation,
  who,
  onClose,
  onSaved,
}: {
  month: string;
  violation: Violation | null;
  who: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={violation !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accepter une violation</DialogTitle>
        </DialogHeader>
        {violation && (
          <AcceptViolationForm month={month} violation={violation} who={who} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
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
