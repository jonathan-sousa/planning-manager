import type { RemovalPolicy } from 'aws-cdk-lib';
import { ConfigurationSet, EmailSendingEvent, EventDestination } from 'aws-cdk-lib/aws-ses';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import type { Database } from './database';
import { nodeFunction } from './node-function';

export interface EmailEventsProps {
  readonly stage: string;
  readonly database: Database;
  readonly removalPolicy: RemovalPolicy;
}

/**
 * SES configuration set of the stage's user pool: bounces and complaints go
 * through SNS to a Lambda (api/email-events.ts) that records them for the
 * accounts page.
 */
export class EmailEvents extends Construct {
  readonly configurationSet: ConfigurationSet;

  constructor(scope: Construct, id: string, props: EmailEventsProps) {
    super(scope, id);

    this.configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: `planning-manager-${props.stage}`,
    });
    const topic = new Topic(this, 'Topic');
    this.configurationSet.addEventDestination('Sns', {
      destination: EventDestination.snsTopic(topic),
      events: [EmailSendingEvent.BOUNCE, EmailSendingEvent.COMPLAINT],
    });

    const handler = nodeFunction(this, 'Function', {
      entry: 'api/email-events.ts',
      removalPolicy: props.removalPolicy,
      environment: { DATABASE_ENDPOINT: props.database.cluster.clusterEndpoint },
    });
    props.database.cluster.grantConnectAdmin(handler);
    topic.addSubscription(new LambdaSubscription(handler));
  }
}
