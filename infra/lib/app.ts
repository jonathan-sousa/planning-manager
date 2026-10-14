import { type App, type Stack, Tags } from 'aws-cdk-lib';
import { EdgeStack } from './edge';
import { MailStack } from './mail';
import { PlanningManagerStack } from './stack';
import { PROD_STAGE } from './stage';
import { stageTags } from './tags';

/** The stacks of a stage, with their dependencies and cost tags. */
export function defineStacks(app: App, stage: string) {
  const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' };

  // Sending domain, shared by every stage; deployed with production only
  // (scripts/deploy.ts), so a change to it is a production change.
  const mail = new MailStack(app, 'PlanningManagerMail', { env });

  // Production is hosted on its own domain: CloudFront needs its certificate and
  // web ACL in us-east-1.
  const edge =
    stage === PROD_STAGE
      ? new EdgeStack(app, `PlanningManagerEdge-${stage}`, {
          stage,
          env: { account: env.account, region: 'us-east-1' },
        })
      : undefined;

  const stageStack = new PlanningManagerStack(app, `PlanningManager-${stage}`, {
    stage,
    env,
    edge,
  });
  stageStack.addStackDependency(mail);

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

  return { mail, edge, stageStack };
}
