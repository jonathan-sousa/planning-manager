import * as dsql from '@aws-cdk/aws-dsql-alpha';
import type { RemovalPolicy } from 'aws-cdk-lib';
import { BackupPlan, BackupResource } from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';

export interface DatabaseProps {
  readonly stage: string;
  readonly isProd: boolean;
  readonly removalPolicy: RemovalPolicy;
}

/**
 * Aurora DSQL cluster (PostgreSQL-compatible, serverless, no VPC). Production
 * gets a daily AWS Backup plan; dev stages stay disposable (a backup vault
 * cannot be deleted while it holds recovery points). Schema migrations are
 * applied by `npm run db:migrate`.
 */
export class Database extends Construct {
  readonly cluster: dsql.Cluster;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.cluster = new dsql.Cluster(this, 'Cluster', {
      clusterName: `planning-manager-${props.stage}`,
      deletionProtection: props.isProd,
      removalPolicy: props.removalPolicy,
    });

    if (props.isProd) {
      const plan = BackupPlan.daily35DayRetention(this, 'BackupPlan');
      plan.addSelection('Cluster', {
        resources: [BackupResource.fromArn(this.cluster.clusterArn)],
      });
    }
  }
}
