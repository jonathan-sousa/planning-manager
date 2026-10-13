import * as dsql from '@aws-cdk/aws-dsql-alpha';
import type { RemovalPolicy } from 'aws-cdk-lib';
import {
  BackupPlan,
  BackupPlanRule,
  BackupResource,
  CfnBackupPlan,
  CfnBackupVault,
} from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';
import { stageTags } from './tags';

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
      // Daily, kept 35 days. CDK tag propagation does not reach AWS Backup's
      // tag maps: the plan, its vault and its recovery points (the backup
      // storage cost) are tagged here.
      const tags = stageTags(props.stage);
      const plan = new BackupPlan(this, 'BackupPlan', {
        backupPlanRules: [
          new BackupPlanRule({ ...BackupPlanRule.daily().props, recoveryPointTags: tags }),
        ],
      });
      (plan.node.defaultChild as CfnBackupPlan).backupPlanTags = tags;
      (plan.backupVault.node.defaultChild as CfnBackupVault).backupVaultTags = tags;
      plan.addSelection('Cluster', {
        resources: [BackupResource.fromArn(this.cluster.clusterArn)],
      });
    }
  }
}
