import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { agentRequestInput, type AgentRequestInput } from '../../shared/schemas';
import { CrudPage } from '@/components/crud-page';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import { optionsOf, requestKindLabels } from '@/lib/labels';
import { useReferences } from '@/lib/options';
import { type AgentRequest, agentRequests, omitMeta } from '@/lib/resources';

export const Route = createFileRoute('/agent-requests')({
  component: AgentRequestsPage,
});

const period = (request: AgentRequest) =>
  request.startDate === request.endDate
    ? formatDate(request.startDate)
    : `${formatDate(request.startDate)} → ${formatDate(request.endDate)}`;

function AgentRequestsPage() {
  const { data, error } = useQuery(agentRequests.query);
  const refs = useReferences();

  return (
    <CrudPage
      title="Demandes des agents"
      noun={{ article: 'une', name: 'demande' }}
      resource={agentRequests}
      rows={data}
      error={error}
      rowLabel={(request) => `la demande de ${refs.agentName.get(request.agentId)}`}
      columns={[
        {
          header: 'Agent',
          className: 'font-medium',
          cell: (request) => refs.agentName.get(request.agentId),
        },
        { header: 'Période', cell: period },
        { header: 'Type', cell: (request) => requestKindLabels[request.kind] },
        {
          header: 'Poste',
          cell: (request) => (request.shiftTypeId ? refs.shiftCode.get(request.shiftTypeId) : '—'),
        },
        { header: 'Commentaire', cell: (request) => request.comment },
      ]}
      renderForm={(props) => <AgentRequestForm {...props} />}
    />
  );
}

const emptyRequest: AgentRequestInput = {
  agentId: '',
  startDate: '',
  endDate: '',
  kind: 'WISH_OFF',
  shiftTypeId: null,
  comment: null,
};

function AgentRequestForm({
  row,
  onSaved,
}: {
  row: AgentRequest | undefined;
  onSaved: () => void;
}) {
  const refs = useReferences({ shiftTypeId: row?.shiftTypeId, agentId: row?.agentId });
  const form = useAppForm({
    defaultValues: row ? omitMeta(row) : emptyRequest,
    validationLogic,
    validators: {
      onDynamic: agentRequestInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(() =>
          row ? agentRequests.update(row.id, value) : agentRequests.create(value)
        ),
    },
    onSubmit: onSaved,
  });

  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="agentId">
          {(field) => <field.SelectField label="Agent" options={refs.agentOptions} />}
        </form.AppField>
        <form.AppField
          name="kind"
          listeners={{
            // The allowed codes depend on the kind: start over.
            onChange: () => form.setFieldValue('shiftTypeId', null),
          }}
        >
          {(field) => <field.SelectField label="Type" options={optionsOf(requestKindLabels)} />}
        </form.AppField>
        <form.AppField
          name="startDate"
          listeners={{
            // Single-day requests are the common case. On blur: date inputs
            // report partial years while being typed.
            onBlur: ({ value }) =>
              !form.getFieldValue('endDate') && form.setFieldValue('endDate', value),
          }}
        >
          {(field) => <field.TextField label="Du" type="date" />}
        </form.AppField>
        <form.AppField name="endDate">
          {(field) => <field.TextField label="Au" type="date" />}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.kind}>
          {(kind) =>
            kind !== 'WISH_OFF' && (
              // Keyed by kind so the select is rebuilt with the matching options.
              <form.AppField key={kind} name="shiftTypeId">
                {(field) =>
                  kind === 'WISH_SHIFT' ? (
                    <field.SelectField label="Poste souhaité" options={refs.workShiftOptions} />
                  ) : (
                    <field.SelectField label="Code d'absence" options={refs.absenceOptions} />
                  )
                }
              </form.AppField>
            )
          }
        </form.Subscribe>
        <div className="sm:col-span-2">
          <form.AppField name="comment">
            {(field) => (
              <field.TextareaField label="Commentaire" description="Jamais de motif médical" />
            )}
          </form.AppField>
        </div>
      </FormShell>
    </form.AppForm>
  );
}
