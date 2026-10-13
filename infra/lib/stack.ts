import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Api } from './api';
import { Auth } from './auth';
import { Database } from './database';
import { APP_DOMAIN, AUTH_DOMAIN, parentZone } from './dns';
import { EmailEvents } from './email-events';
import type { EdgeStack } from './edge';
import { Solver } from './solver';
import { PROD_STAGE } from './stage';
import { Web } from './web';

export interface PlanningManagerStackProps extends StackProps {
  readonly stage: string;
  /** Production only: certificate and web ACL in us-east-1, to host the app on APP_DOMAIN. */
  readonly edge?: EdgeStack;
}

export class PlanningManagerStack extends Stack {
  constructor(scope: Construct, id: string, props: PlanningManagerStackProps) {
    super(scope, id, {
      ...props,
      crossRegionReferences: props.edge !== undefined,
      terminationProtection: props.stage === PROD_STAGE,
    });

    const { stage } = props;
    const isProd = stage === PROD_STAGE;
    const removalPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const bootstrapManagerEmail = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase();
    if (!bootstrapManagerEmail) {
      throw new Error(
        'BOOTSTRAP_MANAGER_EMAIL is not set: it is the email of the first manager created on this stage (see README).'
      );
    }

    // Where the SPA runs: hosted on APP_DOMAIN in production, the Vite dev
    // server on the other stages.
    const { edge } = props;
    // Production records live in the parent zone.
    const zone = parentZone(this);
    const appOrigins = edge ? [`https://${APP_DOMAIN}`] : ['http://localhost:5173'];

    const database = new Database(this, 'Database', { stage, isProd, removalPolicy });
    const emailEvents = new EmailEvents(this, 'EmailEvents', { stage, database, removalPolicy });
    const auth = new Auth(this, 'Auth', {
      stage,
      configurationSetName: emailEvents.configurationSet.configurationSetName,
      customDomain: edge && {
        domainName: AUTH_DOMAIN,
        certificate: edge.certificate,
        zone,
      },
      bootstrapManagerEmail,
      appOrigins,
      isProd,
      removalPolicy,
    });
    const solver = new Solver(this, 'Solver', { database, removalPolicy });
    const api = new Api(this, 'Api', {
      auth,
      database,
      solver,
      allowedOrigins: appOrigins,
      removalPolicy,
    });

    if (edge) {
      const web = new Web(this, 'Web', {
        domainName: APP_DOMAIN,
        zone,
        certificate: edge.certificate,
        webAclArn: edge.webAcl.attrArn,
        config: {
          userPoolId: auth.userPool.userPoolId,
          userPoolClientId: auth.userPoolClient.userPoolClientId,
          authDomain: auth.authDomain,
          apiUrl: api.httpApi.apiEndpoint,
        },
        removalPolicy,
      });
      // Cognito requires the parent of the auth domain to resolve first.
      auth.domain.node.addDependency(web.aliasRecord);
      new CfnOutput(this, 'AppUrl', { value: `https://${APP_DOMAIN}` });
    }

    new CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: auth.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'AuthDomain', { value: auth.authDomain });
    new CfnOutput(this, 'ApiUrl', { value: api.httpApi.apiEndpoint });
    new CfnOutput(this, 'DatabaseEndpoint', { value: database.cluster.clusterEndpoint });
    new CfnOutput(this, 'SolverRoleArn', { value: solver.function.role!.roleArn });
    new CfnOutput(this, 'MailerRoleArn', { value: emailEvents.function.role!.roleArn });
  }
}
