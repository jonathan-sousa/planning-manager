import { App, type Stack, Tags } from 'aws-cdk-lib';
import { EdgeStack } from '../lib/edge';
import { LogsStack } from '../lib/logs';
import { MailStack } from '../lib/mail';
import { PlanningManagerStack } from '../lib/stack';
import { PROD_STAGE, resolveStage } from '../lib/stage';
import { stageTags } from '../lib/tags';

const app = new App();

// One stack per stage (-c stage=…); developers get a personal stage named
// after their user. `npm run infra:deploy [-- <stage>]` deploys one.
const stage = resolveStage(app.node.tryGetContext('stage'));

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' };

// Sending domain, shared by every stage; deployed with production only
// (scripts/deploy.ts), so a change to it is a production change.
const mail = new MailStack(app, 'PlanningManagerMail', { env });

// Production is hosted on its own domain: CloudFront needs its certificate and
// web ACL in us-east-1; the web ACL logs to a bucket in eu-west-3.
const logs =
  stage === PROD_STAGE
    ? new LogsStack(app, `PlanningManagerLogs-${stage}`, { stage, env })
    : undefined;
const edge =
  stage === PROD_STAGE
    ? new EdgeStack(app, `PlanningManagerEdge-${stage}`, {
        stage,
        env: { account: env.account, region: 'us-east-1' },
      })
    : undefined;
if (logs && edge) edge.addStackDependency(logs);

const stageStack = new PlanningManagerStack(app, `PlanningManager-${stage}`, { stage, env, edge });
stageStack.addStackDependency(mail);

// Cost and inventory: every resource carries its project and stage (cost
// allocation tags, to activate once in Billing).
const tag = (stack: Stack | undefined, stageName: string) => {
  for (const [key, value] of Object.entries(stageTags(stageName))) {
    if (stack) Tags.of(stack).add(key, value);
  }
};
tag(mail, 'shared');
tag(logs, stage);
tag(edge, stage);
tag(stageStack, stage);
