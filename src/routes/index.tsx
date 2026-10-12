import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { client } from '@/lib/data-client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const solverHealth = useQuery({
    queryKey: ['solver-health'],
    queryFn: async () => {
      const { data, errors } = await client.queries.solverHealth();
      if (errors?.length) throw new Error(errors.map((error) => error.message).join(', '));
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accueil</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Solveur</CardTitle>
          <CardDescription>Vérification de la Lambda OR-Tools.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {solverHealth.isPending && <p>Vérification…</p>}
          {solverHealth.isError && <p className="text-destructive">{solverHealth.error.message}</p>}
          {solverHealth.data && (
            <p>
              {solverHealth.data.status} — OR-Tools {solverHealth.data.ortoolsVersion}, Python{' '}
              {solverHealth.data.pythonVersion}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
