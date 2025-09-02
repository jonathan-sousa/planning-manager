import { PageWrapper } from "@/components/page-wrapper"

export default function SettingsPage() {
  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Configurez les paramètres de l'application
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Paramètres généraux</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom de l'établissement</label>
              <p className="text-sm text-muted-foreground mt-1">
                Configuration à venir
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Fuseau horaire</label>
              <p className="text-sm text-muted-foreground mt-1">
                Europe/Paris
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notifications par email</label>
              <p className="text-sm text-muted-foreground mt-1">
                Configuration à venir
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Sécurité</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Authentification à deux facteurs</label>
              <p className="text-sm text-muted-foreground mt-1">
                Configuration à venir
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PageWrapper>
  )
}