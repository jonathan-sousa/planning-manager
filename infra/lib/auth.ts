import { type RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnManagedLoginBranding,
  FeaturePlan,
  ManagedLoginVersion,
  OAuthScope,
  UserPool,
  UserPoolEmail,
  type UserPoolClient,
  type UserPoolDomain,
  type UserPoolGroup,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { bootstrapManager } from './bootstrap-manager';
import { MAIL_DOMAIN, MAIL_FROM } from './mail';

export interface AuthProps {
  readonly stage: string;
  readonly bootstrapManagerEmail: string;
  /** Browser origins of the SPA, used as OAuth callback and sign-out URLs. */
  readonly appOrigins: string[];
  readonly isProd: boolean;
  readonly removalPolicy: RemovalPolicy;
}

/**
 * Cognito user pool for managers, with Managed Login (hosted sign-in page,
 * authorization code + PKCE). Accounts are created by an administrator
 * (self sign-up is off); the first one is created at deployment.
 */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
  readonly managersGroup: UserPoolGroup;
  readonly domain: UserPoolDomain;
  /** Host name of the Managed Login pages, without scheme. */
  readonly authDomain: string;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    this.userPool = new UserPool(this, 'UserPool', {
      featurePlan: FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      // SES with the shared sending domain (MailStack), not Cognito's default
      // sender, which is capped and lands in spam.
      email: UserPoolEmail.withSES({
        fromEmail: MAIL_FROM,
        fromName: 'Planning Manager',
        sesRegion: Stack.of(this).region,
        sesVerifiedDomain: MAIL_DOMAIN,
      }),
      userInvitation: {
        emailSubject: 'Votre accès à Planning Manager',
        emailBody:
          'Bonjour,<br><br>Un compte Planning Manager vient de vous être ouvert.<br>' +
          'Identifiant : {username}<br>Mot de passe temporaire : {####}<br><br>' +
          'Vous choisirez votre mot de passe à la première connexion.',
      },
      userVerification: {
        emailSubject: 'Votre code Planning Manager',
        emailBody: 'Votre code de vérification : {####}',
      },
      deletionProtection: props.isProd,
      removalPolicy: props.removalPolicy,
    });

    const appUrls = props.appOrigins.map((origin) => `${origin}/`);
    this.userPoolClient = this.userPool.addClient('Web', {
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: appUrls,
        logoutUrls: appUrls,
      },
      preventUserExistenceErrors: true,
    });

    // Cognito-prefixed domain; a custom domain (ACM certificate in us-east-1)
    // can replace it for production.
    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `planning-manager-${props.stage}` },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });
    this.authDomain = `${this.domain.domainName}.auth.${Stack.of(this).region}.amazoncognito.com`;

    // Managed Login requires a branding style per app client; Cognito defaults.
    new CfnManagedLoginBranding(this, 'Branding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.userPoolClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    this.managersGroup = this.userPool.addGroup('Managers', {
      groupName: 'MANAGERS',
      description: 'Cadres de santé autorisés à gérer les plannings',
    });

    bootstrapManager(
      this,
      this.userPool,
      this.managersGroup,
      props.bootstrapManagerEmail,
      props.removalPolicy
    );
  }
}
