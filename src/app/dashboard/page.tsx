export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Dashboard</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Résumé</h2>
            <p className="text-gray-600">Vue d&apos;ensemble des activités récentes</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Statistiques</h2>
            <p className="text-gray-600">Métriques et indicateurs clés</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Actions rapides</h2>
            <p className="text-gray-600">Raccourcis vers les actions courantes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
