// In-memory user pool standing in for Cognito in the account tests:
//   vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
//     ...(await original()),
//     CognitoIdentityProviderClient: (await import('<path>/test/cognito')).FakeCognitoClient,
//   }));
// Commands are told apart by class name: importing the SDK here would loop
// back into the mock.

export interface FakeUser {
  username: string;
  email: string;
  name: string;
  status: 'CONFIRMED' | 'FORCE_CHANGE_PASSWORD';
  enabled: boolean;
  groups: Set<string>;
  mfa: boolean;
}

/** Pages of two users, to go through the pagination. */
const PAGE = 2;

export const pool = {
  users: [] as FakeUser[],
  /** Commands received, in order: [class name, input]. */
  calls: [] as [string, Record<string, unknown>][],

  reset() {
    this.users = [];
    this.calls = [];
  },

  add(user: Partial<FakeUser> & Pick<FakeUser, 'username' | 'email'>, groups: string[] = []) {
    this.users.push({
      name: '',
      status: 'CONFIRMED',
      enabled: true,
      mfa: true,
      ...user,
      groups: new Set(groups),
    });
  },

  get(username: string) {
    return this.users.find((user) => user.username === username);
  },
};

const failure = (name: string) => Object.assign(new Error(name), { name });

/** Admin commands take the username or the email alias, like Cognito. */
function find(username: unknown): FakeUser {
  const user = pool.users.find((item) => item.username === username || item.email === username);
  if (!user) throw failure('UserNotFoundException');
  return user;
}

const asCognito = (user: FakeUser) => ({
  Username: user.username,
  Enabled: user.enabled,
  UserStatus: user.status,
  UserCreateDate: new Date('2026-10-01T00:00:00Z'),
  Attributes: [
    { Name: 'email', Value: user.email },
    { Name: 'name', Value: user.name },
  ],
});

function page<T>(items: T[], token: unknown) {
  const start = Number(token ?? 0);
  const next = start + PAGE < items.length ? String(start + PAGE) : undefined;
  return { items: items.slice(start, start + PAGE), next };
}

function handle(command: string, input: Record<string, unknown>): unknown {
  switch (command) {
    case 'ListUsersCommand': {
      const { items, next } = page(pool.users, input.PaginationToken);
      return { Users: items.map(asCognito), PaginationToken: next };
    }
    case 'ListUsersInGroupCommand': {
      const members = pool.users.filter((user) => user.groups.has(String(input.GroupName)));
      const { items, next } = page(members, input.NextToken);
      return { Users: items.map(asCognito), NextToken: next };
    }
    case 'AdminGetUserCommand':
      return asCognito(find(input.Username));
    case 'AdminListGroupsForUserCommand':
      return { Groups: [...find(input.Username).groups].map((GroupName) => ({ GroupName })) };
    case 'AdminCreateUserCommand': {
      if (input.MessageAction === 'RESEND') return { User: asCognito(find(input.Username)) };
      if (pool.users.some((user) => user.email === input.Username)) {
        throw failure('UsernameExistsException');
      }
      const attributes = new Map(
        (input.UserAttributes as { Name: string; Value: string }[]).map((item) => [
          item.Name,
          item.Value,
        ])
      );
      const username = crypto.randomUUID();
      pool.add({
        username,
        email: String(input.Username),
        name: attributes.get('name') ?? '',
        status: 'FORCE_CHANGE_PASSWORD',
        mfa: false,
      });
      return { User: asCognito(pool.get(username)!) };
    }
    case 'AdminAddUserToGroupCommand':
      find(input.Username).groups.add(String(input.GroupName));
      return {};
    case 'AdminRemoveUserFromGroupCommand':
      find(input.Username).groups.delete(String(input.GroupName));
      return {};
    case 'AdminUpdateUserAttributesCommand': {
      const user = find(input.Username);
      for (const item of input.UserAttributes as { Name: string; Value: string }[]) {
        if (item.Name === 'name') user.name = item.Value;
      }
      return {};
    }
    case 'AdminDisableUserCommand':
      find(input.Username).enabled = false;
      return {};
    case 'AdminEnableUserCommand':
      find(input.Username).enabled = true;
      return {};
    case 'AdminSetUserMFAPreferenceCommand':
      find(input.Username).mfa = false;
      return {};
    case 'AdminUserGlobalSignOutCommand':
      find(input.Username);
      return {};
    default:
      throw new Error(`Fake Cognito: ${command} not handled`);
  }
}

export class FakeCognitoClient {
  async send(command: { input: Record<string, unknown> }) {
    const name = command.constructor.name;
    pool.calls.push([name, command.input]);
    return handle(name, command.input);
  }
}
