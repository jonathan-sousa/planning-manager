import { HostedZone, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

/** Domain of the production app; also the SES sending domain (MailStack). */
export const APP_DOMAIN = 'planning-manager.lab.jonathan-sousa.com';
/** Managed Login of production; Cognito requires its parent (APP_DOMAIN) to resolve. */
export const AUTH_DOMAIN = `auth.${APP_DOMAIN}`;

/** Parent Route 53 zone, by id: no lookup, so synthesis needs no AWS credentials. */
export function parentZone(scope: Construct): IHostedZone {
  return HostedZone.fromHostedZoneAttributes(scope, 'Zone', {
    hostedZoneId: 'Z0918331Z206A3LVJU81',
    zoneName: 'jonathan-sousa.com',
  });
}
