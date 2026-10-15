import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { addMonths, monthLabel } from '../../shared/calendar';
import { PlanningEditor } from '@/components/planning/planning-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { planningStatusLabels } from '@/lib/labels';
import {
  agentRequests,
  agents,
  coverageNeeds,
  coverageOverrides,
  grades,
  invalidatePlanning,
  plannings,
  ruleSettings,
  shiftTypes,
  skills,
} from '@/lib/resources';

export const Route = createFileRoute('/planning/$month')({
  component: PlanningPage,
});

function PlanningPage() {
  const { month } = Route.useParams();
  const queryClient = useQueryClient();
  const planning = useQuery(plannings.query(month));
  const references = {
    agents: useQuery(agents.query),
    grades: useQuery(grades.query),
    skills: useQuery(skills.query),
    shiftTypes: useQuery(shiftTypes.query),
    needs: useQuery(coverageNeeds.query),
    overrides: useQuery(coverageOverrides.query),
    requests: useQuery(agentRequests.query),
    settings: useQuery(ruleSettings.query),
  };
  const create = useMutation({
    mutationFn: () => plannings.create(month),
    onSuccess: () => invalidatePlanning(queryClient, month),
    onError: (error) => toast.error(error.message),
  });

  const queries = [planning, ...Object.values(references)];
  const error = queries.find((query) => query.error)?.error;
  const ready = queries.every((query) => query.data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mois précédent"
          nativeButton={false}
          render={<Link to="/planning/$month" params={{ month: addMonths(month, -1) }} />}
        >
          <ChevronLeft />
        </Button>
        <h1 className="w-48 text-center text-2xl font-semibold capitalize">{monthLabel(month)}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mois suivant"
          nativeButton={false}
          render={<Link to="/planning/$month" params={{ month: addMonths(month, 1) }} />}
        >
          <ChevronRight />
        </Button>
        {planning.data?.planning && (
          <Badge variant="secondary">{planningStatusLabels[planning.data.planning.status]}</Badge>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}
      {!ready && !error && <p className="text-muted-foreground text-sm">Chargement…</p>}
      {ready && !planning.data!.planning && (
        <div className="space-y-3 rounded-lg border p-6">
          <p className="text-sm">Pas encore de planning pour {monthLabel(month)}.</p>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Créer le planning
          </Button>
        </div>
      )}
      {ready && planning.data!.planning && (
        <PlanningEditor
          key={month}
          month={month}
          data={planning.data!}
          agents={references.agents.data!}
          grades={references.grades.data!}
          skills={references.skills.data!}
          shifts={references.shiftTypes.data!}
          needs={references.needs.data!}
          overrides={references.overrides.data!}
          requests={references.requests.data!}
          settings={references.settings.data!}
        />
      )}
    </div>
  );
}
