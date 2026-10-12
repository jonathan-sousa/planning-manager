import { userInfo } from 'node:os';
import { App } from 'aws-cdk-lib';
import { PlanningManagerStack } from '../lib/stack';

const app = new App();

// One stack per stage. Developers get a personal stage named after their user.
const stage: string = app.node.tryGetContext('stage') ?? userInfo().username;

new PlanningManagerStack(app, `PlanningManager-${stage}`, {
  stage,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' },
});
