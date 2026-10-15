import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { coverageOverrideInput, type CoverageOverrideInput } from '../../shared/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import { useReferences } from '@/lib/options';
import { type CoverageOverride, coverageOverrides, omitMeta } from '@/lib/resources';

export const Route = createFileRoute('/coverage-overrides')({
  component: CoverageOverridesPage,
});

function CoverageOverridesPage() {
  const { data, error } = useQuery(coverageOverrides.query);
  const refs = useReferences();

  return (
    <CrudPage
      title="Exceptions de couverture"
      noun={{ article: 'une', name: 'exception' }}
      resource={coverageOverrides}
      rows={data}
      error={error}
      rowLabel={(item) =>
        `${refs.shiftCode.get(item.shiftTypeId)} ${refs.gradeCode.get(item.gradeId)} du ${formatDate(item.date)}`
      }
      columns={[
        { header: 'Date', className: 'font-medium', cell: (item) => formatDate(item.date) },
        { header: 'Poste', cell: (item) => refs.shiftCode.get(item.shiftTypeId) },
        { header: 'Grade', cell: (item) => refs.gradeCode.get(item.gradeId) },
        {
          header: 'Compétence',
          cell: (item) => (item.skillId ? refs.skillCode.get(item.skillId) : '—'),
        },
        { header: 'Minimum', className: 'text-right', cell: (item) => item.minCount },
      ]}
      renderForm={(props) => <CoverageOverrideForm {...props} />}
    />
  );
}

const emptyOverride: CoverageOverrideInput = {
  date: '',
  shiftTypeId: '',
  gradeId: '',
  skillId: null,
  minCount: 1,
};

function CoverageOverrideForm({
  row,
  onSaved,
}: {
  row: CoverageOverride | undefined;
  onSaved: () => void;
}) {
  const refs = useReferences({ shiftTypeId: row?.shiftTypeId });
  const form = useAppForm({
    defaultValues: row ? omitMeta(row) : emptyOverride,
    validationLogic,
    validators: {
      onDynamic: coverageOverrideInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() =>
          row ? coverageOverrides.update(row.id, value) : coverageOverrides.create(value)
        ),
    },
    onSubmit: onSaved,
  });

  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="date">
          {(field) => <field.TextField label="Date" type="date" />}
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
      </FormShell>
    </form.AppForm>
  );
}
