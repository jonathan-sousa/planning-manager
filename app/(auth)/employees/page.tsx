import { PageWrapper } from "@/components/page-wrapper"

export default function EmployeesPage() {
  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employés</h1>
          <p className="text-muted-foreground">
            Gérez vos employés et leurs informations
          </p>
        </div>
        
        <div className="rounded-lg border p-6">
          <p className="text-muted-foreground">La liste des employés sera affichée ici...</p>
        </div>
      </div>
    </PageWrapper>
  );
}