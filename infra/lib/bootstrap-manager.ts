import type { RemovalPolicy } from 'aws-cdk-lib';
import type { IUserPool, UserPoolGroup } from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

/**
 * Creates the first manager of a fresh stage and adds them to the groups
 * (managers, admins). Cognito emails the invitation with a temporary password.
 *
 * Runs on create and whenever the email changes. A previous bootstrap
 * account is never removed: a deploy must not silently revoke access.
 */
export function bootstrapManager(
  scope: Construct,
  userPool: IUserPool,
  groups: UserPoolGroup[],
  email: string,
  removalPolicy: RemovalPolicy
) {
  // Both custom resources run on the same singleton Lambda: one log group.
  const logGroup = new LogGroup(scope, 'BootstrapManagerLogs', {
    retention: RetentionDays.ONE_MONTH,
    removalPolicy,
  });

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
    logGroup,
  });

  groups.forEach((group, index) => {
    // Stable logical ids, never to rename: the managers group keeps the plain one.
    const id = index === 0 ? 'BootstrapManagerGroup' : `BootstrapManager${group.node.id}Group`;
    const addToGroup = new AwsCustomResource(scope, id, {
      onUpdate: {
        service: 'cognito-identity-provider',
        action: 'AdminAddUserToGroup',
        parameters: {
          UserPoolId: userPool.userPoolId,
          Username: email,
          GroupName: group.groupName,
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
      logGroup,
    });
    addToGroup.node.addDependency(createUser, group);
  });
}
