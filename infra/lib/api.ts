import { Duration, type RemovalPolicy } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpNoneAuthorizer,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { Auth } from './auth';
import type { Database } from './database';
import { nodeFunction } from './node-function';
import type { Solver } from './solver';

export interface ApiProps {
  readonly auth: Auth;
  readonly database: Database;
  readonly solver: Solver;
  /** Browser origins allowed to call the API. */
  readonly allowedOrigins?: string[];
  readonly removalPolicy: RemovalPolicy;
}

/**
 * HTTP API in front of a single Hono Lambda. Cognito access tokens are
 * validated by the JWT authorizer; group membership is checked in the app.
 */
export class Api extends Construct {
  readonly httpApi: HttpApi;
  readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.function = nodeFunction(this, 'Function', {
      entry: 'api/index.ts',
      logGroupId: 'LogGroup',
      removalPolicy: props.removalPolicy,
      environment: {
        DATABASE_ENDPOINT: props.database.cluster.clusterEndpoint,
        SOLVER_FUNCTION_NAME: props.solver.function.functionName,
        USER_POOL_ID: props.auth.userPool.userPoolId,
      },
    });
    props.database.cluster.grantConnectAdmin(this.function);
    props.solver.function.grantInvoke(this.function);
    // Accounts page (api/accounts.ts): no user deletion, accounts are disabled.
    props.auth.userPool.grant(
      this.function,
      'cognito-idp:ListUsers',
      'cognito-idp:ListUsersInGroup',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminDisableUser',
      'cognito-idp:AdminEnableUser',
      'cognito-idp:AdminUserGlobalSignOut'
    );

    const authorizer = new HttpUserPoolAuthorizer('Authorizer', props.auth.userPool, {
      userPoolClients: [props.auth.userPoolClient],
    });

    const integration = new HttpLambdaIntegration('Integration', this.function);
    this.httpApi = new HttpApi(this, 'HttpApi', {
      defaultIntegration: integration,
      defaultAuthorizer: authorizer,
      corsPreflight: {
        allowOrigins: props.allowedOrigins ?? ['http://localhost:5173'],
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    });

    // The protected $default route would otherwise catch CORS preflights and
    // reject them with 401: unauthenticated OPTIONS routes take priority.
    for (const path of ['/', '/{proxy+}']) {
      this.httpApi.addRoutes({
        path,
        methods: [HttpMethod.OPTIONS],
        integration,
        authorizer: new HttpNoneAuthorizer(),
      });
    }
  }
}
