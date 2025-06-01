export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé</h2>
            <p className="text-gray-600">Vue d'ensemble des activités récentes</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiques</h2>
            <p className="text-gray-600">Métriques et indicateurs clés</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <p className="text-gray-600">Raccourcis vers les actions courantes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
