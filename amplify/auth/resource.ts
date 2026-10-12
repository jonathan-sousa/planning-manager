import { defineAuth } from '@aws-amplify/backend';

/**
 * Only managers (cadres de santé) sign in. Accounts are created by an
 * administrator: self sign-up is disabled on the user pool in backend.ts.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['MANAGERS'],
});
