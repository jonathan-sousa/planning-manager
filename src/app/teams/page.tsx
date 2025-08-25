export default function Teams() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Équipes</h1>
          <button className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700">Nouvelle équipe</button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Équipe exemple</h3>
            <p className="mb-4 text-gray-600">Description de l&apos;équipe</p>
            <div className="text-sm text-gray-500">
              <p>Membres: 0</p>
              <p>Manager: Non assigné</p>
            </div>
          </div>

          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 shadow-sm">
            <div className="text-center">
              <p className="text-gray-500">Aucune équipe configurée</p>
              <p className="mt-2 text-sm text-gray-400">Créez votre première équipe</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
