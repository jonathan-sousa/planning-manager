import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { nominalMinutes } from '../../api/calendar';
import { shiftTypeInput, type ShiftTypeInput } from '../../api/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { Badge } from '@/components/ui/badge';
import { formatMinutes } from '@/lib/format';
import { optionsOf, shiftKindLabels } from '@/lib/labels';
import { type ShiftType, shiftTypes } from '@/lib/resources';

export const Route = createFileRoute('/shift-types')({
  component: ShiftTypesPage,
});

function ShiftTypesPage() {
  const { data, error } = useQuery(shiftTypes.query);
  return (
    <CrudPage
      title="Postes"
      noun={{ article: 'un', name: 'poste' }}
      resource={shiftTypes}
      rows={data}
      error={error}
      rowLabel={(shift) => shift.code}
      columns={[
        {
          header: 'Code',
          className: 'w-24',
          cell: (shift) => (
            <span className="flex items-center gap-2 font-medium">
              <span className="size-3 rounded-sm" style={{ backgroundColor: shift.color }} />
              {shift.code}
            </span>
          ),
        },
        { header: 'Libellé', cell: (shift) => shift.label },
        { header: 'Type', cell: (shift) => shiftKindLabels[shift.kind] },
        {
          header: 'Horaires',
          cell: (shift) =>
            shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : '—',
        },
        { header: 'Décompte', cell: (shift) => formatMinutes(shift.countedMinutes) },
        {
          header: 'État',
          cell: (shift) => (
            <span className="flex gap-1">
              {shift.isNight && <Badge variant="secondary">Nuit</Badge>}
              {shift.archived && <Badge variant="outline">Archivé</Badge>}
            </span>
          ),
        },
      ]}
      renderForm={(props) => <ShiftTypeForm {...props} />}
    />
  );
}

const emptyShift: ShiftTypeInput = {
  code: '',
  label: '',
  kind: 'WORK',
  startTime: null,
  endTime: null,
  breakMinutes: 0,
  countedMinutes: Number.NaN,
  isNight: false,
  color: '#3b82f6',
  archived: false,
};

function ShiftTypeForm({ row, onSaved }: { row: ShiftType | undefined; onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: row ? toInput(row) : emptyShift,
    validationLogic,
    validators: {
      onDynamic: shiftTypeInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() => (row ? shiftTypes.update(row.id, value) : shiftTypes.create(value))),
    },
    onSubmit: onSaved,
  });

  // On a new work shift, proposes the counted time (span minus break) and,
  // when the hours change, the night flag (crossing midnight; ending at 00:00
  // does not cross it). An existing shift keeps what was saved.
  const proposeTiming = (hoursChanged: boolean) => {
    const { kind, startTime, endTime, breakMinutes } = form.state.values;
    if (row || kind !== 'WORK' || !startTime || !endTime) return;
    if (hoursChanged) form.setFieldValue('isNight', endTime < startTime && endTime !== '00:00');
    const counted = nominalMinutes(startTime, endTime) - breakMinutes;
    if (counted > 0) form.setFieldValue('countedMinutes', counted);
  };
  const hours = { onChange: () => proposeTiming(true) };
  const timing = { onChange: () => proposeTiming(false) };

  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="code">{(field) => <field.TextField label="Code" />}</form.AppField>
        <form.AppField name="label">{(field) => <field.TextField label="Libellé" />}</form.AppField>
        <form.AppField
          name="kind"
          listeners={{
            // Absences and rest days have no hours, break or night flag.
            onChange: ({ value }) => {
              if (value === 'WORK') return;
              form.setFieldValue('startTime', null);
              form.setFieldValue('endTime', null);
              form.setFieldValue('breakMinutes', 0);
              form.setFieldValue('isNight', false);
            },
          }}
        >
          {(field) => <field.SelectField label="Type" options={optionsOf(shiftKindLabels)} />}
        </form.AppField>
        <form.AppField name="color">
          {(field) => <field.ColorField label="Couleur" />}
        </form.AppField>
        <form.AppField name="startTime" listeners={hours}>
          {(field) => <field.TextField label="Début" type="time" nullable />}
        </form.AppField>
        <form.AppField name="endTime" listeners={hours}>
          {(field) => <field.TextField label="Fin" type="time" nullable />}
        </form.AppField>
        <form.AppField name="breakMinutes" listeners={timing}>
          {(field) => <field.NumberField label="Pause (minutes)" />}
        </form.AppField>
        <form.AppField name="countedMinutes">
          {(field) => (
            <field.DurationField
              label="Temps décompté"
              description="Crédité au solde de l'agent (h:mm)"
            />
          )}
        </form.AppField>
        <form.AppField name="isNight">
          {(field) => <field.SwitchField label="Poste de nuit" />}
        </form.AppField>
        <form.AppField name="archived">
          {(field) => <field.SwitchField label="Archivé" />}
        </form.AppField>
      </FormShell>
    </form.AppForm>
  );
}

function toInput(shift: ShiftType): ShiftTypeInput {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = shift;
  return input;
}
