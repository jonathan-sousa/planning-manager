import { Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { CfnLoggingConfiguration, CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';
import { APP_DOMAIN, AUTH_DOMAIN, parentZone } from './dns';
import { wafLogsBucketName } from './logs';

/**
 * What CloudFront requires in us-east-1, for the production stage: the
 * certificate of the app and Managed Login domains, and the web ACL of the
 * distribution. The stage stack reads them through cross-region references.
 *
 * Neither may be replaced in place (new construct id, or a property that
 * forces replacement): this stack deploys first and could not delete the old
 * one while the distribution, the Cognito domain and the plan still use it.
 * Add the new one beside it, deploy, switch the stage stack, then remove it.
 */
export class EdgeStack extends Stack {
  readonly certificate: Certificate;
  readonly webAcl: CfnWebACL;

  constructor(scope: Construct, id: string, props: StackProps & { stage: string }) {
    super(scope, id, { ...props, crossRegionReferences: true, terminationProtection: true });

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
        sampledRequestsEnabled: false,
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
        sampledRequestsEnabled: false,
        cloudWatchMetricsEnabled: true,
        metricName: 'PlanningManagerWeb',
      },
    });

    // Blocked requests only (requests for the static app, never the API),
    // written to the logs stack's bucket in eu-west-3.
    new CfnLoggingConfiguration(this, 'WafLogging', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [`arn:aws:s3:::${wafLogsBucketName(props.stage, this.account)}`],
      loggingFilter: {
        DefaultBehavior: 'DROP',
        Filters: [
          {
            Behavior: 'KEEP',
            Requirement: 'MEETS_ANY',
            Conditions: [{ ActionCondition: { Action: 'BLOCK' } }],
          },
        ],
      },
    });
  }
}
