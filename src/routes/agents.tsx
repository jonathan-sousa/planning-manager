import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { agentInput, type AgentInput } from '../../api/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { hoursRegimeLabels, nightModeLabels, optionsOf } from '@/lib/labels';
import { type Agent, agents, grades, skills } from '@/lib/resources';

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
});

function AgentsPage() {
  const { data, error } = useQuery(agents.query);
  const gradeList = useQuery(grades.query).data ?? [];
  const skillList = useQuery(skills.query).data ?? [];
  const gradeCode = new Map(gradeList.map((grade) => [grade.id, grade.code]));
  const skillCode = new Map(skillList.map((skill) => [skill.id, skill.code]));

  return (
    <CrudPage
      title="Agents"
      noun={{ article: 'un', name: 'agent' }}
      resource={agents}
      rows={data}
      error={error}
      rowLabel={(agent) => `${agent.firstName} ${agent.lastName}`}
      columns={[
        {
          header: 'Nom',
          className: 'font-medium',
          cell: (agent) => `${agent.lastName} ${agent.firstName}`,
        },
        { header: 'Grade', cell: (agent) => gradeCode.get(agent.gradeId) },
        {
          header: 'Compétences',
          cell: (agent) => (
            <span className="flex flex-wrap gap-1">
              {agent.skillIds.map((id) => (
                <Badge key={id} variant="secondary">
                  {skillCode.get(id)}
                </Badge>
              ))}
            </span>
          ),
        },
        { header: 'Quotité', cell: (agent) => `${agent.workTimeRatio} %` },
        { header: 'Jour / nuit', cell: (agent) => nightModeLabels[agent.nightMode] },
        {
          header: 'Contrat',
          cell: (agent) => (
            <span className="flex items-center gap-2">
              {formatDate(agent.startDate)}
              {agent.endDate && ` → ${formatDate(agent.endDate)}`}
              {!agent.active && <Badge variant="outline">Inactif</Badge>}
            </span>
          ),
        },
      ]}
      renderForm={(props) => <AgentForm {...props} />}
    />
  );
}

const emptyAgent: AgentInput = {
  firstName: '',
  lastName: '',
  gradeId: '',
  skillIds: [],
  workTimeRatio: 100,
  nightMode: 'MIXED',
  hoursRegime: 'MIXED_PRORATA',
  active: true,
  startDate: '',
  endDate: null,
};

function AgentForm({ row, onSaved }: { row: Agent | undefined; onSaved: () => void }) {
  const gradeOptions = (useQuery(grades.query).data ?? []).map((grade) => ({
    value: grade.id,
    label: `${grade.code} — ${grade.label}`,
  }));
  const skillOptions = (useQuery(skills.query).data ?? []).map((skill) => ({
    value: skill.id,
    label: skill.code,
  }));

  const form = useAppForm({
    defaultValues: row ? toInput(row) : emptyAgent,
    validationLogic,
    validators: {
      onDynamic: agentInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() => (row ? agents.update(row.id, value) : agents.create(value))),
    },
    onSubmit: onSaved,
  });

  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="firstName">
          {(field) => <field.TextField label="Prénom" />}
        </form.AppField>
        <form.AppField name="lastName">{(field) => <field.TextField label="Nom" />}</form.AppField>
        <form.AppField name="gradeId">
          {(field) => <field.SelectField label="Grade" options={gradeOptions} />}
        </form.AppField>
        <form.AppField name="workTimeRatio">
          {(field) => <field.NumberField label="Quotité (%)" />}
        </form.AppField>
        <div className="sm:col-span-2">
          <form.AppField name="skillIds">
            {(field) => <field.CheckboxListField label="Compétences" options={skillOptions} />}
          </form.AppField>
        </div>
        <form.AppField name="nightMode">
          {(field) => (
            <field.SelectField
              label="Jour / nuit"
              description="Ce que le solveur peut affecter"
              options={optionsOf(nightModeLabels)}
            />
          )}
        </form.AppField>
        <form.AppField name="hoursRegime">
          {(field) => (
            <field.SelectField
              label="Régime horaire"
              description="Obligation annuelle à temps plein"
              options={optionsOf(hoursRegimeLabels)}
            />
          )}
        </form.AppField>
        <form.AppField name="startDate">
          {(field) => <field.TextField label="Début de contrat" type="date" />}
        </form.AppField>
        <form.AppField name="endDate">
          {(field) => <field.TextField label="Fin de contrat" type="date" nullable />}
        </form.AppField>
        <form.AppField name="active">
          {(field) => <field.SwitchField label="Actif" />}
        </form.AppField>
      </FormShell>
    </form.AppForm>
  );
}

function toInput(agent: Agent): AgentInput {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = agent;
  return input;
}
