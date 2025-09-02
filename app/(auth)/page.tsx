export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenue dans votre gestionnaire de planning
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Employés actifs
            </span>
            <span className="text-2xl font-bold">12</span>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Heures planifiées
            </span>
            <span className="text-2xl font-bold">320h</span>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Taux de couverture
            </span>
            <span className="text-2xl font-bold">95%</span>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Conflits de règles
            </span>
            <span className="text-2xl font-bold">0</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Activité récente</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Planning mis à jour pour la semaine 45
              </span>
              <span className="text-xs text-muted-foreground">Il y a 2h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Nouvel employé ajouté : Marie Dupont
              </span>
              <span className="text-xs text-muted-foreground">Il y a 5h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Règle modifiée : Repos minimum
              </span>
              <span className="text-xs text-muted-foreground">Hier</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
          <div className="space-y-2">
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm">
              → Créer un nouveau planning
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm">
              → Ajouter un employé
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm">
              → Configurer les règles
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm">
              → Exporter le planning actuel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}