import { AuthWrapper } from '@/app/components/auth/AuthWrapper';
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { UserProvider } from '@/lib/contexts/UserContext';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthWrapper>
      <UserProvider>
        <div className="h-screen flex overflow-hidden">
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1 min-h-0">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <div className="flex-1" />
              </header>
              <main className="flex-1 overflow-y-auto p-4">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </UserProvider>
    </AuthWrapper>
  );
}