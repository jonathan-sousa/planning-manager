import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/** WAF log bucket of a stage: its name must start with `aws-waf-logs-`. */
export const wafLogsBucketName = (stage: string, account: string) =>
  `aws-waf-logs-planning-manager-${stage}-${account}`;

/**
 * Production logs kept in eu-west-3: the CloudFront web ACL lives in
 * us-east-1, but writes its logs to this bucket, so they stay in France.
 * Deployed before the edge stack, which names the bucket.
 */
export class LogsStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & { stage: string }) {
    super(scope, id, { ...props, terminationProtection: true });

    const bucket = new Bucket(this, 'WafLogs', {
      bucketName: wafLogsBucketName(props.stage, this.account),
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(365) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Log delivery for this account's web ACLs (written here rather than by
    // WAF, which would otherwise edit a policy this stack owns).
    const delivery = new ServicePrincipal('delivery.logs.amazonaws.com');
    const fromThisAccount = {
      StringEquals: { 'aws:SourceAccount': this.account },
      ArnLike: { 'aws:SourceArn': `arn:aws:logs:*:${this.account}:*` },
    };
    bucket.addToResourcePolicy(
      new PolicyStatement({
        principals: [delivery],
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects(`AWSLogs/${this.account}/*`)],
        conditions: {
          ...fromThisAccount,
          StringEquals: {
            ...fromThisAccount.StringEquals,
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      })
    );
    bucket.addToResourcePolicy(
      new PolicyStatement({
        principals: [delivery],
        actions: ['s3:GetBucketAcl'],
        resources: [bucket.bucketArn],
        conditions: fromThisAccount,
      })
    );
  }
}
