import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DAY_KINDS } from '../../api/domain';
import { coverageNeedInput, type CoverageNeedInput } from '../../api/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { dayKindLabels, optionsOf } from '@/lib/labels';
import { useReferences } from '@/lib/options';
import { type CoverageNeed, coverageNeeds, omitMeta } from '@/lib/resources';

export const Route = createFileRoute('/coverage-needs')({
  component: CoverageNeedsPage,
});

function CoverageNeedsPage() {
  const { data, error } = useQuery(coverageNeeds.query);
  const refs = useReferences();
  // Day kind, then shift, grade and skill (the general need before its skill).
  const sortKey = (need: CoverageNeed) =>
    [
      DAY_KINDS.indexOf(need.dayKind),
      refs.shiftCode.get(need.shiftTypeId),
      refs.gradeOrder.get(need.gradeId),
      need.skillId ? refs.skillCode.get(need.skillId) : '',
    ].join('|');
  const rows = data?.toSorted((a, b) => sortKey(a).localeCompare(sortKey(b), 'fr'));
  const label = (need: CoverageNeed) =>
    `${refs.shiftCode.get(need.shiftTypeId)} ${refs.gradeCode.get(need.gradeId)} (${dayKindLabels[need.dayKind]})`;

  return (
    <CrudPage
      title="Besoins de couverture"
      noun={{ article: 'un', name: 'besoin' }}
      resource={coverageNeeds}
      rows={rows}
      error={error}
      rowLabel={label}
      columns={[
        { header: 'Jour', cell: (need) => dayKindLabels[need.dayKind] },
        {
          header: 'Poste',
          className: 'font-medium',
          cell: (need) => refs.shiftCode.get(need.shiftTypeId),
        },
        { header: 'Grade', cell: (need) => refs.gradeCode.get(need.gradeId) },
        {
          header: 'Compétence',
          cell: (need) => (need.skillId ? refs.skillCode.get(need.skillId) : '—'),
        },
        { header: 'Minimum', className: 'text-right', cell: (need) => need.minCount },
        { header: 'Cible', className: 'text-right', cell: (need) => need.targetCount ?? '—' },
      ]}
      renderForm={(props) => <CoverageNeedForm {...props} />}
    />
  );
}

const emptyNeed: CoverageNeedInput = {
  shiftTypeId: '',
  gradeId: '',
  skillId: null,
  dayKind: 'WEEKDAY',
  minCount: 1,
  targetCount: null,
};

function CoverageNeedForm({
  row,
  onSaved,
}: {
  row: CoverageNeed | undefined;
  onSaved: () => void;
}) {
  const refs = useReferences({ shiftTypeId: row?.shiftTypeId });
  const form = useAppForm({
    defaultValues: row ? omitMeta(row) : emptyNeed,
    validationLogic,
    validators: {
      onDynamic: coverageNeedInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() =>
          row ? coverageNeeds.update(row.id, value) : coverageNeeds.create(value)
        ),
    },
    onSubmit: onSaved,
  });

  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="dayKind">
          {(field) => <field.SelectField label="Jour" options={optionsOf(dayKindLabels)} />}
        </form.AppField>
        <form.AppField name="shiftTypeId">
          {(field) => <field.SelectField label="Poste" options={refs.workShiftOptions} />}
        </form.AppField>
        <form.AppField name="gradeId">
          {(field) => <field.SelectField label="Grade" options={refs.gradeOptions} />}
        </form.AppField>
        <form.AppField name="skillId">
          {(field) => <field.SelectField label="Compétence" options={refs.skillOptions} nullable />}
        </form.AppField>
        <form.AppField name="minCount">
          {(field) => <field.NumberField label="Minimum" />}
        </form.AppField>
        <form.AppField name="targetCount">
          {(field) => (
            <field.NumberField label="Cible" description="Effectif souhaité, facultatif" nullable />
          )}
        </form.AppField>
      </FormShell>
    </form.AppForm>
  );
}
