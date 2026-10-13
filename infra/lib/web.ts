import * as path from 'node:path';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  Distribution,
  HttpVersion,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CfnSubscription } from 'aws-cdk-lib/aws-pricingplanmanager';
import { AaaaRecord, ARecord, type IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface WebProps {
  readonly domainName: string;
  readonly zone: IHostedZone;
  /** us-east-1 certificate covering `domainName` (EdgeStack). */
  readonly certificate: ICertificate;
  /** ARN of the CLOUDFRONT-scope web ACL (EdgeStack). */
  readonly webAclArn: string;
  /** Read by the SPA at startup (src/config.ts): ids and URLs of this stage. */
  readonly config: Record<string, string>;
  readonly removalPolicy: RemovalPolicy;
}

const distDir = path.resolve(import.meta.dirname, '../../dist');

/**
 * The SPA on S3 behind CloudFront (origin access control), on its own domain,
 * under the CloudFront flat-rate Free plan (CDN, WAF and DDoS protection).
 * `npm run build` must run before synthesis: `dist/` is deployed as is,
 * next to a `config.json` written with this stage's values.
 */
export class Web extends Construct {
  readonly distribution: Distribution;
  /** A record of the domain: Cognito needs it before a custom auth subdomain. */
  readonly aliasRecord: ARecord;

  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id);

    const bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.removalPolicy === RemovalPolicy.DESTROY,
    });

    this.distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      domainNames: [props.domainName],
      certificate: props.certificate,
      webAclId: props.webAclArn,
      httpVersion: HttpVersion.HTTP2_AND_3,
      defaultRootObject: 'index.html',
      // Client-side routes (/planning/2026-11) are not objects: serve the app.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });

    new CfnSubscription(this, 'FreePlan', {
      planFamily: 'CloudFront',
      planTier: 'FREE',
      resourceArns: [
        `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
        props.webAclArn,
      ],
    });

    const target = RecordTarget.fromAlias(new CloudFrontTarget(this.distribution));
    this.aliasRecord = new ARecord(this, 'Alias', {
      zone: props.zone,
      recordName: props.domainName,
      target,
    });
    new AaaaRecord(this, 'AliasIpv6', { zone: props.zone, recordName: props.domainName, target });

    // Hashed assets never change; the page and its config are always revalidated.
    const assets = new BucketDeployment(this, 'Assets', {
      sources: [Source.asset(distDir)],
      destinationBucket: bucket,
      include: ['assets/*'],
      exclude: ['*'],
      cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
      prune: false,
    });
    const page = new BucketDeployment(this, 'Page', {
      sources: [Source.asset(distDir), Source.jsonData('config.json', props.config)],
      destinationBucket: bucket,
      exclude: ['assets/*'],
      cacheControl: [CacheControl.noCache()],
      prune: false,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // The new page only once the assets it references are there.
    page.node.addDependency(assets);
  }
}
