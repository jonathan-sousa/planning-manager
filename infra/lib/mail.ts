import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { CnameRecord, HostedZone, MxRecord, TxtRecord } from 'aws-cdk-lib/aws-route53';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';

/** Sending domain, shared by every stage: a subdomain keeps its reputation apart. */
export const MAIL_DOMAIN = 'planning-manager.lab.jonathan-sousa.com';
export const MAIL_FROM = `no-reply@${MAIL_DOMAIN}`;
// Parent zone, by id: no lookup, so synthesis needs no AWS credentials.
const PARENT_ZONE = { hostedZoneId: 'Z0918331Z206A3LVJU81', zoneName: 'jonathan-sousa.com' };

/**
 * SES domain identity of MAIL_DOMAIN, authenticated in the parent Route 53
 * zone: Easy DKIM, custom MAIL FROM and DMARC. Deployed once per account,
 * before the stage stacks whose user pools send through it; every stage,
 * prod included, depends on it, hence the termination protection.
 */
export class MailStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, terminationProtection: true });

    const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', PARENT_ZONE);
    const mailFromDomain = `mail.${MAIL_DOMAIN}`;

    const identity = new EmailIdentity(this, 'Identity', {
      identity: Identity.domain(MAIL_DOMAIN),
      mailFromDomain,
    });

    // Identity.publicHostedZone() would verify the zone apex; the subdomain's
    // records are written here instead.
    identity.dkimRecords.forEach(({ name, value }, index) => {
      new CnameRecord(this, `Dkim${index + 1}`, {
        zone,
        // Already fully qualified: the trailing dot stops CDK appending the zone.
        recordName: `${name}.`,
        domainName: value,
        ttl: Duration.hours(1),
      });
    });
    new MxRecord(this, 'MailFromMx', {
      zone,
      recordName: mailFromDomain,
      values: [{ priority: 10, hostName: `feedback-smtp.${this.region}.amazonses.com` }],
    });
    new TxtRecord(this, 'MailFromSpf', {
      zone,
      recordName: mailFromDomain,
      values: ['v=spf1 include:amazonses.com ~all'],
    });
    // Only SES sends for this domain. DKIM aligns strictly (d= is the From
    // domain); SPF only relaxed, since SES's MAIL FROM must be a subdomain.
    new TxtRecord(this, 'Dmarc', {
      zone,
      recordName: `_dmarc.${MAIL_DOMAIN}`,
      values: ['v=DMARC1; p=quarantine; adkim=s; aspf=r'],
    });
  }
}
