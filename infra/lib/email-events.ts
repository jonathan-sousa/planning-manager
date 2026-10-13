import type { RemovalPolicy } from 'aws-cdk-lib';
import { ConfigurationSet, EmailSendingEvent, EventDestination } from 'aws-cdk-lib/aws-ses';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { Database } from './database';
import { nodeFunction } from './node-function';

export interface EmailEventsProps {
  readonly stage: string;
  readonly database: Database;
  readonly removalPolicy: RemovalPolicy;
}

/**
 * SES configuration set of the stage's user pool: deliveries, bounces and
 * complaints go through SNS to a Lambda (api/email-events.ts) that records
 * them for the accounts page.
 */
export class EmailEvents extends Construct {
  readonly configurationSet: ConfigurationSet;
  readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: EmailEventsProps) {
    super(scope, id);

    this.configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: `planning-manager-${props.stage}`,
    });
    const topic = new Topic(this, 'Topic');
    this.configurationSet.addEventDestination('Sns', {
      destination: EventDestination.snsTopic(topic),
      events: [EmailSendingEvent.DELIVERY, EmailSendingEvent.BOUNCE, EmailSendingEvent.COMPLAINT],
    });

    this.function = nodeFunction(this, 'Function', {
      entry: 'api/email-events.ts',
      removalPolicy: props.removalPolicy,
      environment: {
        DATABASE_ENDPOINT: props.database.cluster.clusterEndpoint,
        DATABASE_USER: 'mailer',
      },
    });
    // Connects as the `mailer` database role (migration 0008), mapped to this
    // function's IAM role by `npm run db:migrate`.
    props.database.cluster.grantConnect(this.function);
    topic.addSubscription(new LambdaSubscription(this.function));
  }
}
