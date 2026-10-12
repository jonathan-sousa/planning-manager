import type { IUserPool, UserPoolGroup } from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

/**
 * Creates the first manager of a fresh stage and adds them to the managers
 * group. Cognito emails the invitation with a temporary password.
 *
 * Runs on create and whenever the email changes. A previous bootstrap
 * account is never removed: a deploy must not silently revoke access.
 */
export function bootstrapManager(
  scope: Construct,
  userPool: IUserPool,
  managersGroup: UserPoolGroup,
  email: string
) {
  const createUser = new AwsCustomResource(scope, 'BootstrapManagerUser', {
    onUpdate: {
      service: 'cognito-identity-provider',
      action: 'AdminCreateUser',
      parameters: {
        UserPoolId: userPool.userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      },
      physicalResourceId: PhysicalResourceId.of(email),
      ignoreErrorCodesMatching: 'UsernameExistsException',
    },
    policy: AwsCustomResourcePolicy.fromStatements([
      new PolicyStatement({
        actions: ['cognito-idp:AdminCreateUser'],
        resources: [userPool.userPoolArn],
      }),
    ]),
    installLatestAwsSdk: false,
    logRetention: RetentionDays.ONE_MONTH,
  });

  const addToGroup = new AwsCustomResource(scope, 'BootstrapManagerGroup', {
    onUpdate: {
      service: 'cognito-identity-provider',
      action: 'AdminAddUserToGroup',
      parameters: {
        UserPoolId: userPool.userPoolId,
        Username: email,
        GroupName: managersGroup.groupName,
      },
      physicalResourceId: PhysicalResourceId.of(email),
    },
    policy: AwsCustomResourcePolicy.fromStatements([
      new PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: [userPool.userPoolArn],
      }),
    ]),
    installLatestAwsSdk: false,
    logRetention: RetentionDays.ONE_MONTH,
  });
  addToGroup.node.addDependency(createUser, managersGroup);
}
