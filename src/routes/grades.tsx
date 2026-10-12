import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { gradeInput } from '../../api/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { type Grade, grades } from '@/lib/resources';

export const Route = createFileRoute('/grades')({
  component: GradesPage,
});

function GradesPage() {
  const { data, error } = useQuery(grades.query);
  return (
    <CrudPage
      title="Grades"
      noun={{ article: 'un', name: 'grade' }}
      resource={grades}
      rows={data}
      error={error}
      rowLabel={(grade) => grade.code}
      columns={[
        { header: 'Code', cell: (grade) => grade.code, className: 'w-28 font-medium' },
        { header: 'Libellé', cell: (grade) => grade.label },
      ]}
      renderForm={(props) => <GradeForm {...props} />}
    />
  );
}

function GradeForm({ row, onSaved }: { row: Grade | undefined; onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: { code: row?.code ?? '', label: row?.label ?? '' },
    validationLogic,
    validators: {
      onDynamic: gradeInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() => (row ? grades.update(row.id, value) : grades.create(value))),
    },
    onSubmit: onSaved,
  });
  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="code">{(field) => <field.TextField label="Code" />}</form.AppField>
        <form.AppField name="label">{(field) => <field.TextField label="Libellé" />}</form.AppField>
      </FormShell>
    </form.AppForm>
  );
}
