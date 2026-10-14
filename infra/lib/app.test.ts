// Invariants of the synthesized stacks, learnt the hard way: each one guards
// a setting that a deployment once got wrong or that production relies on.
import { App, type Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { defineStacks } from './app';

// No AWS call: a fake account, no asset bundling (the production stack still
// reads dist/index.html: `npm run build` first, as `npm run check` does).
function synth(stage: string) {
  process.env.CDK_DEFAULT_ACCOUNT = '123456789012';
  process.env.BOOTSTRAP_MANAGER_EMAIL = 'premier@example.org';
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  return defineStacks(app, stage);
}

const template = (stack: Stack) => Template.fromStack(stack);
const tags = (stage: string) => Match.arrayWith([{ Key: 'Stage', Value: stage }]);

describe('a development stage', () => {
  let stage: Template;
  beforeAll(() => {
    stage = template(synth('dev').stageStack);
  });

  it('signs in through Managed Login only, with an email in any case and TOTP', () => {
    stage.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'ON',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
      UsernameConfiguration: { CaseSensitive: false },
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      UserPoolTier: 'ESSENTIALS',
    });
    stage.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
      WriteAttributes: [],
    });
  });

  it('gives each Lambda its database role', () => {
    const roles = Object.values(stage.findResources('AWS::Lambda::Function'))
      .map((fn) => fn.Properties.Environment?.Variables?.DATABASE_USER)
      .filter(Boolean)
      .sort();
    expect(roles).toEqual(['admin', 'mailer']);
    stage.hasOutput('SolverRoleArn', {});
    stage.hasOutput('MailerRoleArn', {});
  });

  it('lets the API manage accounts, never delete them', () => {
    const actions = Object.values(stage.findResources('AWS::IAM::Policy'))
      .flatMap((policy) => policy.Properties.PolicyDocument.Statement)
      .flatMap((statement: { Action: string | string[] }) => statement.Action)
      .filter((action: string) => action.startsWith('cognito-idp:'));
    expect(actions).toContain('cognito-idp:AdminDisableUser');
    expect(actions).toContain('cognito-idp:AdminUserGlobalSignOut');
    expect(actions.some((action: string) => action.includes('Delete'))).toBe(false);
  });

  it('throttles and logs every API call', () => {
    stage.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 25, ThrottlingBurstLimit: 50 },
      AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
    });
  });

  it('is destroyed freely, without the hosting of production', () => {
    stage.hasResourceProperties('AWS::DSQL::Cluster', { DeletionProtectionEnabled: false });
    stage.resourceCountIs('AWS::CloudFront::Distribution', 0);
    stage.resourceCountIs('AWS::Backup::BackupPlan', 0);
  });

  it('tags its resources with the project and the stage', () => {
    stage.hasResourceProperties('AWS::DSQL::Cluster', {
      Tags: Match.arrayWith([{ Key: 'Project', Value: 'planning-manager' }]),
    });
    stage.hasResourceProperties('AWS::DSQL::Cluster', { Tags: tags('dev') });
  });
});

describe('production', () => {
  let stacks: ReturnType<typeof synth>;
  let stage: Template;
  beforeAll(() => {
    stacks = synth('prod');
    stage = template(stacks.stageStack);
  });

  it('protects its stacks and keeps its data', () => {
    expect(stacks.stageStack.terminationProtection).toBe(true);
    expect(stacks.edge?.terminationProtection).toBe(true);
    expect(stacks.mail.terminationProtection).toBe(true);
    stage.hasResourceProperties('AWS::DSQL::Cluster', { DeletionProtectionEnabled: true });
    for (const type of ['AWS::DSQL::Cluster', 'AWS::Cognito::UserPool', 'AWS::S3::Bucket']) {
      for (const resource of Object.values(stage.findResources(type))) {
        expect(resource.DeletionPolicy, type).toBe('Retain');
      }
    }
    stage.resourceCountIs('AWS::Backup::BackupPlan', 1);
  });

  it('serves the app on the CloudFront Free plan, which takes no custom headers', () => {
    stage.resourceCountIs('AWS::PricingPlanManager::Subscription', 1);
    stage.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 0);
    stage.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ WebACLId: Match.anyValue() }),
    });
  });

  it('filters the app with AWS managed rules, within the plan limit of 5', () => {
    const edge = template(stacks.edge!);
    const [acl] = Object.values(edge.findResources('AWS::WAFv2::WebACL'));
    const rules = acl!.Properties.Rules as unknown[];
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.length).toBeLessThanOrEqual(5);
  });

  it('tags the shared mail stack apart', () => {
    template(stacks.mail).hasResourceProperties('AWS::SES::EmailIdentity', {
      Tags: tags('shared'),
    });
  });
});
