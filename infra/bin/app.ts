import { userInfo } from 'node:os';
import { App, type Stack, Tags } from 'aws-cdk-lib';
import { EdgeStack } from '../lib/edge';
import { MailStack } from '../lib/mail';
import { PlanningManagerStack } from '../lib/stack';
import { stageTags } from '../lib/tags';

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
const mail = new MailStack(app, 'PlanningManagerMail', { env });

// Production is hosted on its own domain: CloudFront needs its certificate and
// web ACL in us-east-1.
const edge =
  stage === 'prod'
    ? new EdgeStack(app, `PlanningManagerEdge-${stage}`, {
        env: { account: env.account, region: 'us-east-1' },
      })
    : undefined;

const stageStack = new PlanningManagerStack(app, `PlanningManager-${stage}`, { stage, env, edge });

// Cost and inventory: every resource carries its project and stage (cost
// allocation tags, to activate once in Billing).
const tag = (stack: Stack | undefined, stageName: string) => {
  for (const [key, value] of Object.entries(stageTags(stageName))) {
    if (stack) Tags.of(stack).add(key, value);
  }
};
tag(mail, 'shared');
tag(edge, stage);
tag(stageStack, stage);
