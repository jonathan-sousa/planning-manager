import { Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';
import { APP_DOMAIN, AUTH_DOMAIN, parentZone } from './dns';

/**
 * What CloudFront requires in us-east-1, for the production stage: the
 * certificate of the app and Managed Login domains, and the web ACL of the
 * distribution. The stage stack reads them through cross-region references.
 */
export class EdgeStack extends Stack {
  readonly certificate: Certificate;
  readonly webAcl: CfnWebACL;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, crossRegionReferences: true });

    this.certificate = new Certificate(this, 'Certificate', {
      domainName: APP_DOMAIN,
      subjectAlternativeNames: [AUTH_DOMAIN],
      validation: CertificateValidation.fromDns(parentZone(this)),
    });

    // AWS managed rules, included in the CloudFront flat-rate plan.
    const managedRule = (name: string, priority: number) => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
    });
    this.webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      rules: [
        managedRule('AWSManagedRulesAmazonIpReputationList', 0),
        managedRule('AWSManagedRulesCommonRuleSet', 1),
        managedRule('AWSManagedRulesKnownBadInputsRuleSet', 2),
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'PlanningManagerWeb',
      },
    });
  }
}
