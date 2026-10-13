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
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, type IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { bootstrapManager } from './bootstrap-manager';
import { MAIL_DOMAIN, MAIL_FROM } from './mail';

export interface AuthProps {
  readonly stage: string;
  /** Managed Login on its own domain (production); a Cognito prefix otherwise. */
  readonly customDomain?: {
    readonly domainName: string;
    /** us-east-1 certificate covering `domainName`. */
    readonly certificate: ICertificate;
    readonly zone: IHostedZone;
  };
  readonly bootstrapManagerEmail: string;
  /** Browser origins of the SPA, used as OAuth callback and sign-out URLs. */
  readonly appOrigins: string[];
  /** SES configuration set of the user pool's emails (bounces and complaints recorded). */
  readonly configurationSetName: string;
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
  readonly adminsGroup: UserPoolGroup;
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
        configurationSetName: props.configurationSetName,
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

    const custom = props.customDomain;
    if (custom) {
      this.domain = this.userPool.addDomain('CustomDomain', {
        customDomain: { domainName: custom.domainName, certificate: custom.certificate },
        managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
      });
      new ARecord(this, 'DomainAlias', {
        zone: custom.zone,
        recordName: custom.domainName,
        target: RecordTarget.fromAlias(new UserPoolDomainTarget(this.domain)),
      });
      this.authDomain = custom.domainName;
    } else {
      this.domain = this.userPool.addDomain('Domain', {
        cognitoDomain: { domainPrefix: `planning-manager-${props.stage}` },
        managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
      });
      this.authDomain = `${this.domain.domainName}.auth.${Stack.of(this).region}.amazoncognito.com`;
    }

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

    this.adminsGroup = this.userPool.addGroup('Admins', {
      groupName: 'ADMINS',
      description: 'Managers qui gèrent les comptes et les règles de planification',
    });

    bootstrapManager(
      this,
      this.userPool,
      [this.managersGroup, this.adminsGroup],
      props.bootstrapManagerEmail,
      props.removalPolicy
    );
  }
}
