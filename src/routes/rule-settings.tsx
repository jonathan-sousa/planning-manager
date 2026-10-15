import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ruleSettingsInput, type RuleSettingsInput } from '../../shared/schemas';
import { useIsAdmin } from '@/auth/session';
import { FormShell } from '@/components/form-fields';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { omitMeta, type RuleSettings, ruleSettings } from '@/lib/resources';

export const Route = createFileRoute('/rule-settings')({
  component: RuleSettingsPage,
});

function RuleSettingsPage() {
  const { data, error } = useQuery(ruleSettings.query);
  const isAdmin = useIsAdmin();
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Règles de planification</h1>
        <p className="text-muted-foreground text-sm">
          Valeurs par défaut de la fonction publique hospitalière (décret 2002-9), à ajuster au
          protocole temps de travail de l'établissement.
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
      {!isAdmin && (
        <p className="text-muted-foreground text-sm">
          Lecture seule : seuls les admins modifient les règles.
        </p>
      )}
      {data && <RuleSettingsForm settings={data} readOnly={!isAdmin} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="font-medium sm:col-span-2">{title}</h2>
      {children}
    </>
  );
}

function RuleSettingsForm({ settings, readOnly }: { settings: RuleSettings; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const defaultValues = omitMeta(settings);
  const form = useAppForm({
    defaultValues: defaultValues satisfies RuleSettingsInput,
    validationLogic,
    validators: {
      onDynamic: ruleSettingsInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(async () => {
          const saved = await ruleSettings.update(value);
          queryClient.setQueryData(ruleSettings.query.queryKey, saved);
        }),
    },
    onSubmit: () => {
      toast.success('Règles enregistrées');
    },
  });

  return (
    <form.AppForm>
      <FormShell readOnly={readOnly}>
        <Section title="Durées (h:mm)">
          <form.AppField name="minDailyRestMinutes">
            {(field) => <field.DurationField label="Repos quotidien minimal" />}
          </form.AppField>
          <form.AppField name="maxShiftAmplitudeMinutes">
            {(field) => <field.DurationField label="Amplitude maximale d'un poste" />}
          </form.AppField>
          <form.AppField name="breakThresholdMinutes">
            {(field) => <field.DurationField label="Travail continu avant pause" />}
          </form.AppField>
          <form.AppField name="minBreakMinutes">
            {(field) => <field.DurationField label="Pause minimale" />}
          </form.AppField>
          <form.AppField name="maxWeeklyMinutes">
            {(field) => (
              <field.DurationField
                label="Durée maximale sur 7 jours"
                description="7 jours glissants"
              />
            )}
          </form.AppField>
          <form.AppField name="minWeeklyRestMinutes">
            {(field) => <field.DurationField label="Repos hebdomadaire minimal" />}
          </form.AppField>
        </Section>

        <Section title="Repos et enchaînements">
          <form.AppField name="fortnightMinRestDays">
            {(field) => (
              <field.NumberField
                label="Jours de repos par quinzaine"
                description="Dont 2 consécutifs incluant un dimanche"
              />
            )}
          </form.AppField>
          <form.AppField name="fortnightAnchorDate">
            {(field) => (
              <field.TextField label="Début des quinzaines" description="Un lundi" type="date" />
            )}
          </form.AppField>
          <form.AppField name="maxConsecutiveWorkDays">
            {(field) => <field.NumberField label="Jours travaillés consécutifs (max.)" />}
          </form.AppField>
          <form.AppField name="restDayExcludesPreviousNight">
            {(field) => <field.SwitchField label="Pas de nuit la veille d'un jour de repos" />}
          </form.AppField>
        </Section>

        <Section title="Heures du mois">
          <form.AppField name="monthlyHoursToleranceMinutes">
            {(field) => (
              <field.DurationField
                label="Tolérance autour de la cible"
                description="Écart accepté sans pénalité"
              />
            )}
          </form.AppField>
        </Section>

        <Section title="Poids des contraintes souples (0 à 100)">
          <form.AppField name="hoursDeviationWeight">
            {(field) => <field.NumberField label="Écart aux heures cibles" />}
          </form.AppField>
          <form.AppField name="wishWeight">
            {(field) => <field.NumberField label="Souhaits des agents" />}
          </form.AppField>
          <form.AppField name="weekendFairnessWeight">
            {(field) => <field.NumberField label="Équité des week-ends" />}
          </form.AppField>
          <form.AppField name="nightFairnessWeight">
            {(field) => <field.NumberField label="Équité des nuits" />}
          </form.AppField>
          <form.AppField name="holidayFairnessWeight">
            {(field) => <field.NumberField label="Équité des fériés" />}
          </form.AppField>
          <form.AppField name="isolatedRestDayWeight">
            {(field) => <field.NumberField label="Jours de repos isolés" />}
          </form.AppField>
          <form.AppField name="stabilityWeight">
            {(field) => <field.NumberField label="Stabilité du brouillon" />}
          </form.AppField>
        </Section>
      </FormShell>
    </form.AppForm>
  );
}
