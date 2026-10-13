import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import {
  Award,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Clock,
  House,
  LogOut,
  MessageSquare,
  Scale,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useIsAdmin } from '@/auth/groups';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navigation = [
  {
    label: undefined,
    items: [
      { to: '/', label: 'Accueil', icon: House },
      { to: '/planning', label: 'Planning', icon: CalendarDays },
    ],
  },
  {
    label: 'Référentiels',
    items: [
      { to: '/agents', label: 'Agents', icon: Users },
      { to: '/grades', label: 'Grades', icon: ShieldCheck },
      { to: '/skills', label: 'Compétences', icon: Award },
      { to: '/shift-types', label: 'Postes', icon: Clock },
    ],
  },
  {
    label: 'Planification',
    items: [
      { to: '/coverage-needs', label: 'Besoins', icon: CalendarClock },
      { to: '/coverage-overrides', label: 'Exceptions', icon: CalendarX },
      { to: '/agent-requests', label: 'Demandes', icon: MessageSquare },
      { to: '/rule-settings', label: 'Règles', icon: Scale },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [{ to: '/accounts', label: 'Comptes', icon: UserCog }],
  },
] as const;

export function AppSidebar() {
  const isAdmin = useIsAdmin();
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
        {navigation
          .filter((group) => !('adminOnly' in group) || isAdmin)
          .map((group) => (
            <SidebarGroup key={group.label ?? 'main'}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ to, label, icon: Icon }) => (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        render={
                          <Link
                            to={to}
                            activeOptions={{ exact: to === '/' }}
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
          ))}
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
