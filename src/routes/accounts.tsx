import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { KeyRound, Mail, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { accountInput, accountUpdateInput } from '../../shared/schemas';
import { useIsAdmin, useSession } from '@/auth/session';
import { CrudPage } from '@/components/crud-page';
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
import { submitToApi, useAppForm, validationLogic } from '@/hooks/form';
import { formatDate } from '@/lib/format';
import { type Account, accounts } from '@/lib/resources';

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
});

const day = (timestamp: string) => formatDate(timestamp.slice(0, 10));

function AccountsPage() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ ...accounts.query, enabled: isAdmin });
  const own = useSession()?.username;
  const [disabling, setDisabling] = useState<Account | null>(null);
  const [resettingMfa, setResettingMfa] = useState<Account | null>(null);
  const reload = () => queryClient.invalidateQueries({ queryKey: accounts.query.queryKey });

  const resend = useMutation({
    mutationFn: (account: Account) => accounts.resend(account.username),
    onSuccess: () => toast.success('Invitation renvoyée'),
    onError: (error) => toast.error(error.message),
  });
  const resetMfa = useMutation({
    mutationFn: (account: Account) => accounts.resetMfa(account.username),
    onSuccess: () =>
      toast.success('MFA réinitialisé : nouvelle application à la prochaine connexion'),
    onError: (error) => toast.error(error.message),
    onSettled: () => setResettingMfa(null),
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

  const label = (account: Account) => account.name || account.email;
  const action = (title: string, account: Account) => ({
    variant: 'ghost' as const,
    size: 'icon-sm' as const,
    title,
    'aria-label': `${title} : ${label(account)}`,
  });

  return (
    <>
      <CrudPage
        title="Comptes"
        description="Les admins gèrent les comptes et les règles de planification ; les managers, tout le reste. Un compte désactivé garde l'accès au plus une heure (durée de sa session)."
        noun={{ article: 'un', name: 'compte' }}
        createLabel="Inviter"
        resource={accounts}
        rows={data}
        rowId={(account) => account.username}
        error={error}
        rowLabel={label}
        rowClassName={(account) => (account.enabled ? '' : 'opacity-60')}
        columns={[
          {
            header: 'Nom',
            cell: (account) => account.name || '—',
            className: 'font-medium',
          },
          {
            header: 'Email',
            cell: (account) => (
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
            ),
          },
          { header: 'Rôle', cell: (account) => (account.admin ? 'Admin' : 'Manager') },
          {
            header: 'État',
            className: 'text-muted-foreground',
            cell: (account) =>
              !account.enabled
                ? 'Désactivé'
                : account.status === 'FORCE_CHANGE_PASSWORD'
                  ? `Invité le ${day(account.createdAt)}`
                  : 'Actif',
          },
        ]}
        rowActions={(account) => (
          <>
            {account.enabled && account.status === 'FORCE_CHANGE_PASSWORD' && (
              <Button
                {...action("Renvoyer l'invitation", account)}
                disabled={resend.isPending}
                onClick={() => resend.mutate(account)}
              >
                <Mail />
              </Button>
            )}
            {account.username !== own && account.enabled && account.status === 'CONFIRMED' && (
              <Button
                {...action('Réinitialiser le MFA (téléphone perdu ou changé)', account)}
                onClick={() => setResettingMfa(account)}
              >
                <KeyRound />
              </Button>
            )}
            {account.username !== own &&
              (account.enabled ? (
                <Button {...action('Désactiver', account)} onClick={() => setDisabling(account)}>
                  <UserX />
                </Button>
              ) : (
                <Button
                  {...action('Réactiver', account)}
                  disabled={setEnabled.isPending}
                  onClick={() => setEnabled.mutate({ account, enabled: true })}
                >
                  <UserCheck />
                </Button>
              ))}
          </>
        )}
        renderForm={({ row, onSaved }) =>
          row ? (
            <EditForm account={row} self={row.username === own} onSaved={onSaved} />
          ) : (
            <InviteForm onSaved={onSaved} />
          )
        }
      />

      <AlertDialog
        open={resettingMfa !== null}
        onOpenChange={(open) => !open && setResettingMfa(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Réinitialiser le MFA de {resettingMfa && label(resettingMfa)} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Son application d'authentification est oubliée : à la prochaine connexion, il en
              enregistrera une nouvelle avec son seul mot de passe. Vérifiez d'abord son identité
              (appel, en personne). Ses sessions en cours sont fermées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMfa.isPending}
              onClick={() => resettingMfa && resetMfa.mutate(resettingMfa)}
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={disabling !== null} onOpenChange={(open) => !open && setDisabling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver {disabling && label(disabling)} ?</AlertDialogTitle>
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
    </>
  );
}

function InviteForm({ onSaved }: { onSaved: () => void }) {
  const form = useAppForm({
    defaultValues: { email: '', name: '', admin: false },
    validationLogic,
    validators: {
      onDynamic: accountInput,
      onSubmitAsync: ({ value }) =>
        submitToApi(async () => {
          const { created } = await accounts.invite(value);
          // An existing account outside the app only gets its access back.
          toast.success(created ? 'Invitation envoyée' : 'Accès rétabli pour ce compte existant');
        }),
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
