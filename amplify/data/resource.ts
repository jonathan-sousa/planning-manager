import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { solver } from '../functions/solver/resource';

const schema = a.schema({
  Grade: a
    .model({
      code: a.string().required(),
      label: a.string().required(),
      order: a.integer().required(),
    })
    .authorization((allow) => [allow.groups(['MANAGERS'])]),

  SolverHealth: a.customType({
    ortoolsVersion: a.string().required(),
    pythonVersion: a.string().required(),
    status: a.string().required(),
  }),

  solverHealth: a
    .query()
    .returns(a.ref('SolverHealth'))
    .handler(a.handler.function(solver))
    .authorization((allow) => [allow.groups(['MANAGERS'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
