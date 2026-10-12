import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { bootstrapManager } from './auth/bootstrap-manager';
import { data } from './data/resource';
import { solver } from './functions/solver/resource';

const bootstrapManagerEmail = process.env.BOOTSTRAP_MANAGER_EMAIL;
if (!bootstrapManagerEmail) {
  throw new Error(
    'BOOTSTRAP_MANAGER_EMAIL is not set: it is the email of the first manager created on this stage (see README).'
  );
}

const backend = defineBackend({
  auth,
  data,
  solver,
});

backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

bootstrapManager(
  backend.auth.stack,
  backend.auth.resources.userPool,
  backend.auth.resources.groups['MANAGERS'].cfnUserGroup,
  bootstrapManagerEmail
);

for (const table of Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables)) {
  table.pointInTimeRecoveryEnabled = true;
}
