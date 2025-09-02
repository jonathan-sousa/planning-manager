import { PageWrapper } from "@/components/page-wrapper"

export default function RulesPage() {
  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Règles de planning</h1>
          <p className="text-muted-foreground">
            Configurez les règles de gestion des plannings
          </p>
        </div>
        
        <div className="rounded-lg border p-6">
          <p className="text-muted-foreground">Les règles de planning seront affichées ici...</p>
        </div>
      </div>
    </PageWrapper>
  );
}