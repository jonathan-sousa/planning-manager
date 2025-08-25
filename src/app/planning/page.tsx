export default function Planning() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Planning</h1>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Nouveau planning</button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Vue calendrier</h2>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-500">Interface de planning à développer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
