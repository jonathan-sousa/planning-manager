import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Planning Manager
            </Link>
          </div>

          <nav className="hidden space-x-8 md:flex">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/planning"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Planning
            </Link>
            <Link href="/teams" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Équipes
            </Link>
          </nav>

          <div className="md:hidden">
            <button className="text-gray-600 hover:text-gray-900">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
