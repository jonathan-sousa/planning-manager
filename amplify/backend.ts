import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * Backend configuration - Planning Manager
 *
 * Last updated: 2025-11-18
 * Backend version: 1.18.0
 *
 * @see https://docs.amplify.aws/react/build-a-backend/
 */
defineBackend({
  auth,
  data,
});
