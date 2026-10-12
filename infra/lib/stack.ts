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

    const auth = new Auth(this, 'Auth', { bootstrapManagerEmail, isProd, removalPolicy });
    const database = new Database(this, 'Database', { stage, isProd, removalPolicy });
    const solver = new Solver(this, 'Solver', { database });
    const api = new Api(this, 'Api', { auth, database, solver });

    new CfnOutput(this, 'Region', { value: this.region });
    new CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: auth.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'ApiUrl', { value: api.httpApi.apiEndpoint });
    new CfnOutput(this, 'DatabaseEndpoint', { value: database.cluster.clusterEndpoint });
  }
}
