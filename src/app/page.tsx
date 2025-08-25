export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Bienvenue sur Planning Manager</h1>
          <p className="mb-8 text-xl text-gray-600">Gérez efficacement les plannings de vos équipes</p>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Dashboard</h3>
              <p className="text-gray-600">Vue d&apos;ensemble de vos plannings et équipes</p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Planning</h3>
              <p className="text-gray-600">Créez et gérez les plannings de travail</p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Équipes</h3>
              <p className="text-gray-600">Organisez et administrez vos équipes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
