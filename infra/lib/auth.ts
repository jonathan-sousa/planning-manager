import type { RemovalPolicy } from 'aws-cdk-lib';
import {
  AccountRecovery,
  FeaturePlan,
  UserPool,
  type UserPoolClient,
  type UserPoolGroup,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { bootstrapManager } from './bootstrap-manager';

export interface AuthProps {
  readonly bootstrapManagerEmail: string;
  readonly isProd: boolean;
  readonly removalPolicy: RemovalPolicy;
}

/**
 * Cognito user pool for managers. Accounts are created by an administrator
 * (self sign-up is off); the first one is created at deployment.
 */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
  readonly managersGroup: UserPoolGroup;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    this.userPool = new UserPool(this, 'UserPool', {
      featurePlan: FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      deletionProtection: props.isProd,
      removalPolicy: props.removalPolicy,
    });

    // The SPA signs in with SRP through the Amplify Authenticator.
    this.userPoolClient = this.userPool.addClient('Web', {
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    this.managersGroup = this.userPool.addGroup('Managers', {
      groupName: 'MANAGERS',
      description: 'Cadres de santé autorisés à gérer les plannings',
    });

    bootstrapManager(this, this.userPool, this.managersGroup, props.bootstrapManagerEmail);
  }
}
