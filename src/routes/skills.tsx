import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { skillInput } from '../../api/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { type Skill, skills } from '@/lib/resources';

export const Route = createFileRoute('/skills')({
  component: SkillsPage,
});

function SkillsPage() {
  const { data, error } = useQuery(skills.query);
  return (
    <CrudPage
      title="Compétences"
      noun={{ article: 'une', name: 'compétence' }}
      resource={skills}
      rows={data}
      error={error}
      rowLabel={(grade) => grade.code}
      columns={[
        { header: 'Code', cell: (grade) => grade.code, className: 'w-28 font-medium' },
        { header: 'Libellé', cell: (grade) => grade.label },
      ]}
      renderForm={(props) => <SkillForm {...props} />}
    />
  );
}

function SkillForm({ row, onSaved }: { row: Skill | undefined; onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: { code: row?.code ?? '', label: row?.label ?? '' },
    validationLogic,
    validators: {
      onDynamic: skillInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() => (row ? skills.update(row.id, value) : skills.create(value))),
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
