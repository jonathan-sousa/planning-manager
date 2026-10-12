import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, unwrap } from '@/lib/api-client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health.$get().then(unwrap),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accueil</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Backend</CardTitle>
          <CardDescription>Base de données et solveur OR-Tools.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {health.isPending && <p>Vérification…</p>}
          {health.isError && <p className="text-destructive">{health.error.message}</p>}
          {health.data && (
            <ul className="space-y-1">
              <li>Base de données : {health.data.database}</li>
              <li>
                Solveur : {health.data.solver.status} — OR-Tools {health.data.solver.ortoolsVersion}
                , Python {health.data.solver.pythonVersion}, base {health.data.solver.database}
              </li>
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
