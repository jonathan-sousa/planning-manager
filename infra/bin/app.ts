import { userInfo } from 'node:os';
import { App } from 'aws-cdk-lib';
import { MailStack } from '../lib/mail';
import { PlanningManagerStack } from '../lib/stack';

const app = new App();

// One stack per stage. Developers get a personal stage named after their user.
const stage: string = app.node.tryGetContext('stage') ?? userInfo().username;
if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(stage)) {
  throw new Error(
    `Invalid stage "${stage}": use lowercase letters, digits and dashes (-c stage=…)`
  );
}

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' };

// Shared by every stage, deployed once (npm run infra:deploy:mail).
new MailStack(app, 'PlanningManagerMail', { env });

new PlanningManagerStack(app, `PlanningManager-${stage}`, { stage, env });
