import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Mail, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { accountInput, accountUpdateInput } from '../../api/schemas';
import { useIsAdmin } from '@/auth/groups';
import { FormShell } from '@/components/form-fields';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import { type Account, accounts } from '@/lib/resources';

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
});

/** Cognito username of the signed-in user: their own account cannot be disabled or demoted. */
function useOwnUsername() {
  return useQuery({
    queryKey: ['auth-username'],
    queryFn: async () => {
      const { tokens } = await fetchAuthSession();
      return String(tokens?.accessToken.payload.username ?? '');
    },
  }).data;
}

const day = (timestamp: string) => formatDate(timestamp.slice(0, 10));

function AccountsPage() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ ...accounts.query, enabled: isAdmin });
  const own = useOwnUsername();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [disabling, setDisabling] = useState<Account | null>(null);
  const reload = () => queryClient.invalidateQueries({ queryKey: accounts.query.queryKey });

  const resend = useMutation({
    mutationFn: (account: Account) => accounts.resend(account.username),
    onSuccess: () => toast.success('Invitation renvoyée'),
    onError: (error) => toast.error(error.message),
  });
  const setEnabled = useMutation({
    mutationFn: ({ account, enabled }: { account: Account; enabled: boolean }) =>
      accounts.setEnabled(account.username, enabled),
    onSuccess: reload,
    onError: (error) => toast.error(error.message),
    onSettled: () => setDisabling(null),
  });

  if (!isAdmin) {
    return <p className="text-muted-foreground text-sm">Page réservée aux admins.</p>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Comptes</h1>
          <p className="text-muted-foreground text-sm">
            Les admins gèrent les comptes et les règles de planification ; les managers, tout le
            reste. Un compte désactivé garde l'accès au plus une heure (durée de sa session).
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Inviter
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>État</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((account) => (
            <TableRow key={account.username} className={account.enabled ? '' : 'opacity-60'}>
              <TableCell className="font-medium">{account.name || '—'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {account.email}
                  {account.emailIssue && (
                    <Badge
                      variant="destructive"
                      title={`${account.emailIssue.detail ?? ''} — ${day(account.emailIssue.occurredAt)}`}
                    >
                      {account.emailIssue.kind === 'BOUNCE' ? 'Email rejeté' : 'Signalé comme spam'}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{account.admin ? 'Admin' : 'Manager'}</TableCell>
              <TableCell className="text-muted-foreground">
                {!account.enabled
                  ? 'Désactivé'
                  : account.status === 'FORCE_CHANGE_PASSWORD'
                    ? `Invité le ${day(account.createdAt)}`
                    : 'Actif'}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Modifier"
                    onClick={() => setEditing(account)}
                  >
                    <Pencil />
                  </Button>
                  {account.enabled && account.status === 'FORCE_CHANGE_PASSWORD' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Renvoyer l'invitation"
                      disabled={resend.isPending}
                      onClick={() => resend.mutate(account)}
                    >
                      <Mail />
                    </Button>
                  )}
                  {account.username !== own &&
                    (account.enabled ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Désactiver"
                        onClick={() => setDisabling(account)}
                      >
                        <UserX />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Réactiver"
                        disabled={setEnabled.isPending}
                        onClick={() => setEnabled.mutate({ account, enabled: true })}
                      >
                        <UserCheck />
                      </Button>
                    ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'Inviter un compte' : 'Modifier le compte'}
            </DialogTitle>
          </DialogHeader>
          {editing === 'new' && (
            <InviteForm
              onSaved={() => {
                setEditing(null);
                toast.success('Invitation envoyée');
                void reload();
              }}
            />
          )}
          {editing && editing !== 'new' && (
            <EditForm
              account={editing}
              self={editing.username === own}
              onSaved={() => {
                setEditing(null);
                void reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={disabling !== null} onOpenChange={(open) => !open && setDisabling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver {disabling?.name || disabling?.email} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte ne pourra plus se connecter ; sa session en cours expire dans l'heure. Il
              reste réactivable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={setEnabled.isPending}
              onClick={() => disabling && setEnabled.mutate({ account: disabling, enabled: false })}
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteForm({ onSaved }: { onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: { email: '', name: '', admin: false },
    validationLogic,
    validators: {
      onDynamic: accountInput,
      onSubmitAsync: ({ value }) => submitToApi(() => accounts.invite(value)),
    },
    onSubmit: onSaved,
  });
  return (
    <form.AppForm>
      <FormShell>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              type="email"
              label="Email"
              description="L'invitation y est envoyée, avec un mot de passe temporaire."
            />
          )}
        </form.AppField>
        <form.AppField name="name">
          {(field) => <field.TextField label="Nom" description="Prénom et nom" />}
        </form.AppField>
        <form.AppField name="admin">
          {(field) => (
            <field.SwitchField
              label="Admin"
              description="Gère les comptes et les règles de planification."
            />
          )}
        </form.AppField>
      </FormShell>
    </form.AppForm>
  );
}

function EditForm({
  account,
  self,
  onSaved,
}: {
  account: Account;
  /** The signed-in user's own account: the admin role stays. */
  self: boolean;
  onSaved: () => void;
}) {
  const form = useAppForm({
    defaultValues: { name: account.name, admin: account.admin },
    validationLogic,
    validators: {
      onDynamic: accountUpdateInput,
      onSubmitAsync: ({ value }) => submitToApi(() => accounts.update(account.username, value)),
    },
    onSubmit: onSaved,
  });
  return (
    <form.AppForm>
      <p className="text-muted-foreground text-sm">{account.email}</p>
      <FormShell>
        <form.AppField name="name">{(field) => <field.TextField label="Nom" />}</form.AppField>
        {!self && (
          <form.AppField name="admin">
            {(field) => (
              <field.SwitchField
                label="Admin"
                description="Gère les comptes et les règles de planification."
              />
            )}
          </form.AppField>
        )}
      </FormShell>
    </form.AppForm>
  );
}
