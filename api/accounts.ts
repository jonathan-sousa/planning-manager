// Accounts of the app: the Cognito users of the stage's user pool, with their
// groups. Admins manage them through api/routes/accounts.ts.
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { createMiddleware } from 'hono/factory';
import { type Bindings, callerName } from './auth';
import { ADMIN_GROUP, MANAGER_GROUP } from './domain';

const cognito = new CognitoIdentityProviderClient({});
const userPoolId = () => process.env.USER_POOL_ID;

export interface Account {
  /** Cognito username (generated: sign-in is by email). */
  username: string;
  email: string;
  name: string;
  /** FORCE_CHANGE_PASSWORD until the invitation is used, then CONFIRMED. */
  status: string;
  enabled: boolean;
  admin: boolean;
  createdAt: string;
}

const attribute = (user: UserType, name: string) =>
  user.Attributes?.find((item) => item.Name === name)?.Value ?? '';

async function groupMembers(group: string): Promise<Set<string>> {
  const usernames = new Set<string>();
  let token: string | undefined;
  do {
    const page = await cognito.send(
      new ListUsersInGroupCommand({ UserPoolId: userPoolId(), GroupName: group, NextToken: token })
    );
    for (const user of page.Users ?? []) usernames.add(user.Username!);
    token = page.NextToken;
  } while (token);
  return usernames;
}

/** Members of the managers group (admins included), with their admin flag. */
export async function listAccounts(): Promise<Account[]> {
  const [managers, admins] = await Promise.all([
    groupMembers(MANAGER_GROUP),
    groupMembers(ADMIN_GROUP),
  ]);
  const accounts: Account[] = [];
  let token: string | undefined;
  do {
    const page = await cognito.send(
      new ListUsersCommand({ UserPoolId: userPoolId(), PaginationToken: token })
    );
    for (const user of page.Users ?? []) {
      if (!managers.has(user.Username!)) continue;
      accounts.push({
        username: user.Username!,
        email: attribute(user, 'email'),
        name: attribute(user, 'name'),
        status: user.UserStatus ?? 'UNKNOWN',
        enabled: user.Enabled ?? false,
        admin: admins.has(user.Username!),
        createdAt: user.UserCreateDate?.toISOString() ?? '',
      });
    }
    token = page.PaginationToken;
  } while (token);
  return accounts;
}

/** Groups and enabled flag of a user, read live from Cognito (not from a token). */
async function liveState(username: string) {
  const [user, groups] = await Promise.all([
    cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId(), Username: username })),
    cognito.send(
      new AdminListGroupsForUserCommand({ UserPoolId: userPoolId(), Username: username })
    ),
  ]);
  const names = new Set(groups.Groups?.map((group) => group.GroupName));
  return {
    username: user.Username!,
    enabled: user.Enabled ?? false,
    manager: names.has(MANAGER_GROUP),
    admin: names.has(ADMIN_GROUP),
  };
}

/**
 * Admin routes check the caller live: an access token keeps its groups up to
 * an hour, so a demoted or disabled admin could otherwise undo it.
 */
export const requireActiveAdmin = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const caller = await liveState(callerName(c.env.event));
  if (!caller.enabled || !caller.admin) return c.json({ error: 'Forbidden' }, 403);
  await next();
});

async function setGroup(username: string, group: string, member: boolean) {
  const Command = member ? AdminAddUserToGroupCommand : AdminRemoveUserFromGroupCommand;
  await cognito.send(
    new Command({ UserPoolId: userPoolId(), Username: username, GroupName: group })
  );
}

/**
 * Creates the account; Cognito emails the invitation with a temporary
 * password. An existing user outside the managers group (an invitation that
 * failed halfway) gets its groups instead; `created` tells which.
 */
export async function inviteAccount(input: {
  email: string;
  name: string;
  admin: boolean;
}): Promise<{ username: string; created: boolean } | 'exists'> {
  let username: string;
  let created = true;
  try {
    const { User } = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId(),
        Username: input.email,
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: input.name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      })
    );
    username = User!.Username!;
  } catch (error) {
    if (!(error instanceof Error && error.name === 'UsernameExistsException')) throw error;
    const existing = await liveState(input.email);
    if (existing.manager) return 'exists';
    ({ username } = existing);
    created = false;
  }
  await setGroup(username, MANAGER_GROUP, true);
  if (input.admin) await setGroup(username, ADMIN_GROUP, true);
  return { username, created };
}

/** Sends the invitation again, with a new temporary password. */
export async function resendInvitation(email: string) {
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId(),
      Username: email,
      MessageAction: 'RESEND',
      DesiredDeliveryMediums: ['EMAIL'],
    })
  );
}

export async function updateAccount(username: string, input: { name: string; admin: boolean }) {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId(),
      Username: username,
      UserAttributes: [{ Name: 'name', Value: input.name }],
    })
  );
  await setGroup(username, ADMIN_GROUP, input.admin);
}

/**
 * Forgets the user's authenticator app: MFA being required, Managed Login asks
 * them to enroll a new one at their next sign-in. Their sessions are revoked.
 */
export async function resetMfa(username: string) {
  const params = { UserPoolId: userPoolId(), Username: username };
  await cognito.send(
    new AdminSetUserMFAPreferenceCommand({
      ...params,
      SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
    })
  );
  await cognito.send(new AdminUserGlobalSignOutCommand(params));
}

/** A disabled account cannot sign in; its refresh tokens are revoked. */
export async function setAccountEnabled(username: string, enabled: boolean) {
  const params = { UserPoolId: userPoolId(), Username: username };
  if (enabled) {
    await cognito.send(new AdminEnableUserCommand(params));
  } else {
    await cognito.send(new AdminDisableUserCommand(params));
    await cognito.send(new AdminUserGlobalSignOutCommand(params));
  }
}
