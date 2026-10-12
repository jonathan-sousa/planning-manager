import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { CalendarDays, House, LogOut, ShieldCheck } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navigation = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/grades', label: 'Grades', icon: ShieldCheck },
] as const;

export function AppSidebar() {
  const { data: email } = useQuery({
    queryKey: ['user-email'],
    queryFn: async () => {
      const { tokens } = await fetchAuthSession();
      return String(tokens?.idToken?.payload.email ?? '');
    },
  });

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <CalendarDays className="size-5" />
          Planning Manager
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    render={
                      <Link
                        to={to}
                        activeOptions={{ exact: true }}
                        activeProps={{ 'data-active': true }}
                      />
                    }
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="text-muted-foreground truncate px-2 text-xs">{email}</div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
