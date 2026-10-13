import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Api } from './api';
import { Auth } from './auth';
import { Database } from './database';
import { Solver } from './solver';

export interface PlanningManagerStackProps extends StackProps {
  readonly stage: string;
}

export class PlanningManagerStack extends Stack {
  constructor(scope: Construct, id: string, props: PlanningManagerStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProd = stage === 'prod';
    const removalPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const bootstrapManagerEmail = process.env.BOOTSTRAP_MANAGER_EMAIL;
    if (!bootstrapManagerEmail) {
      throw new Error(
        'BOOTSTRAP_MANAGER_EMAIL is not set: it is the email of the first manager created on this stage (see README).'
      );
    }

    // Where the SPA runs: the Vite dev server until the app is hosted (phase 4).
    const appOrigins = ['http://localhost:5173'];

    const auth = new Auth(this, 'Auth', {
      stage,
      bootstrapManagerEmail,
      appOrigins,
      isProd,
      removalPolicy,
    });
    const database = new Database(this, 'Database', { stage, isProd, removalPolicy });
    const solver = new Solver(this, 'Solver', { database, removalPolicy });
    const api = new Api(this, 'Api', {
      auth,
      database,
      solver,
      allowedOrigins: appOrigins,
      removalPolicy,
    });

    new CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: auth.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'AuthDomain', { value: auth.authDomain });
    new CfnOutput(this, 'ApiUrl', { value: api.httpApi.apiEndpoint });
    new CfnOutput(this, 'DatabaseEndpoint', { value: database.cluster.clusterEndpoint });
    new CfnOutput(this, 'SolverRoleArn', { value: solver.function.role!.roleArn });
  }
}
