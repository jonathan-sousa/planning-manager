import { App } from 'aws-cdk-lib';
import { defineStacks } from '../lib/app';
import { resolveStage } from '../lib/stage';

const app = new App();

// One stack per stage (-c stage=…); developers get a personal stage named
// after their user. `npm run infra:deploy [-- <stage>]` deploys one.
defineStacks(app, resolveStage(app.node.tryGetContext('stage')));
