export default function Teams() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Équipes</h1>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Nouvelle équipe</button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Équipe exemple</h3>
            <p className="text-gray-600 mb-4">Description de l'équipe</p>
            <div className="text-sm text-gray-500">
              <p>Membres: 0</p>
              <p>Manager: Non assigné</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-dashed border-gray-300">
            <div className="text-center">
              <p className="text-gray-500">Aucune équipe configurée</p>
              <p className="text-sm text-gray-400 mt-2">Créez votre première équipe</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
