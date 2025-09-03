import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // Profil utilisateur étendu
  UserProfile: a
    .model({
      userId: a.id().required(),
      email: a.string(),
      name: a.string(),
      phone: a.string(),
      department: a.string(),
      role: a.string(),
      joinDate: a.datetime(),
      avatarUrl: a.string(),
      // Relation 1-1 avec les préférences
      preferences: a.hasOne('UserPreferences', 'profileId'),
      // Métadonnées
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // Seul le propriétaire peut lire/modifier son profil
      allow.groups(['ADMINS']), // Les admins peuvent tout voir
    ]),

  // Préférences utilisateur
  UserPreferences: a
    .model({
      profileId: a.id().required(), // Lien vers UserProfile
      // Apparence
      theme: a.enum(['light', 'dark', 'auto']),
      language: a.enum(['fr', 'en', 'es', 'de']),
      density: a.enum(['comfortable', 'standard', 'compact']),
      
      // Localisation
      dateFormat: a.enum(['dd_mm_yyyy', 'mm_dd_yyyy', 'yyyy_mm_dd']),
      timeFormat: a.enum(['h24', 'h12']),
      timezone: a.string(),
      firstDayOfWeek: a.enum(['monday', 'sunday', 'saturday']),
      
      // Planning
      defaultView: a.enum(['month', 'week', 'day', 'list']),
      autoSave: a.boolean().default(true),
      
      // Notifications
      emailNotifications: a.boolean().default(true),
      pushNotifications: a.boolean().default(false),
      planningNotifications: a.boolean().default(true),
      conflictNotifications: a.boolean().default(true),
      reminderNotifications: a.boolean().default(true),
      
      // Export
      exportFormat: a.enum(['pdf', 'excel', 'csv', 'ical']),
      includeWeekends: a.boolean().default(true),
      includeStats: a.boolean().default(true),
      
      // Relation inverse
      profile: a.belongsTo('UserProfile', 'profileId'),
      
      // Métadonnées
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(), // Seul le propriétaire peut lire/modifier son profil
      allow.groups(['ADMINS']), // Les admins peuvent tout voir
    ]),

  // Table pour l'historique d'activité (optionnel mais utile)
  ActivityLog: a
    .model({
      userId: a.id().required(),
      action: a.string().required(),
      description: a.string(),
      metadata: a.json(), // Données additionnelles flexibles
      ipAddress: a.string(),
      userAgent: a.string(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [
      allow.owner(), // Seul le propriétaire peut lire/modifier son profil
      allow.groups(['ADMINS']), // Les admins peuvent tout voir
    ]),

  // Todo existant (on le garde pour compatibilité)
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
      allow.groups(['ADMINS'])
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Changé pour userPool (Cognito)
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
