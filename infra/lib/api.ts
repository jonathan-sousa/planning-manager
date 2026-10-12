import * as path from 'node:path';
import { Duration } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpNoneAuthorizer,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { Auth } from './auth';
import type { Database } from './database';
import type { Solver } from './solver';

export interface ApiProps {
  readonly auth: Auth;
  readonly database: Database;
  readonly solver: Solver;
  /** Browser origins allowed to call the API. */
  readonly allowedOrigins?: string[];
}

const apiEntry = path.resolve(import.meta.dirname, '../../api/index.ts');

/**
 * HTTP API in front of a single Hono Lambda. Cognito access tokens are
 * validated by the JWT authorizer; group membership is checked in the app.
 */
export class Api extends Construct {
  readonly httpApi: HttpApi;
  readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.function = new NodejsFunction(this, 'Function', {
      entry: apiEntry,
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: {
        DATABASE_ENDPOINT: props.database.cluster.clusterEndpoint,
        SOLVER_FUNCTION_NAME: props.solver.function.functionName,
      },
      bundling: {
        format: OutputFormat.ESM,
        mainFields: ['module', 'main'],
        // Optional native/runtime-specific requires inside `pg`.
        externalModules: ['pg-native', 'cloudflare:sockets'],
        // CommonJS dependencies bundled into ESM still call `require`.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    });
    props.database.cluster.grantConnectAdmin(this.function);
    props.solver.function.grantInvoke(this.function);

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
