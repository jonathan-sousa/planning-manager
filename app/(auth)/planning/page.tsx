import { PageWrapper } from "@/components/page-wrapper"

export default function PlanningPage() {
  const daysInMonth = 30
  const employees = [
    { id: 1, name: "Marie Dupont" },
    { id: 2, name: "Jean Martin" },
    { id: 3, name: "Sophie Bernard" },
    { id: 4, name: "Pierre Durand" },
    { id: 5, name: "Emma Petit" },
  ]

  return (
    <PageWrapper maxWidth="full">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground">
            Novembre 2024 - Gestion des plannings employés
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border rounded-lg hover:bg-accent">
            ← Octobre
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-accent">
            Décembre →
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 min-w-[150px] sticky left-0 bg-background">
                Employé
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i} className="min-w-[40px] p-1 text-center text-xs">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b hover:bg-muted/50">
                <td className="p-2 font-medium sticky left-0 bg-background">
                  {employee.name}
                </td>
                {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                  const isWeekend = (dayIndex % 7 === 5) || (dayIndex % 7 === 6)
                  const hasShift = Math.random() > 0.3 && !isWeekend
                  
                  return (
                    <td 
                      key={dayIndex} 
                      className={`p-1 text-center border-l text-xs ${
                        isWeekend ? 'bg-muted/30' : ''
                      }`}
                    >
                      {hasShift && (
                        <div className="bg-primary text-primary-foreground rounded px-1">
                          8h
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary rounded"></div>
            <span>Shift assigné</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted/30 rounded"></div>
            <span>Weekend</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            Optimiser automatiquement
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-accent">
            Exporter
          </button>
        </div>
      </div>
      </div>
    </PageWrapper>
  )
}