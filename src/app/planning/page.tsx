export default function Planning() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Planning</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Nouveau planning</button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vue calendrier</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Interface de planning à développer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
