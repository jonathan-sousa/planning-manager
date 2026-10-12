import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Aurora DSQL: random UUID primary keys, timestamps in UTC, no SERIAL.
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
};

export const grades = pgTable(
  'grades',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    label: text().notNull(),
    sortOrder: integer('sort_order').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('grades_code_idx').on(table.code)]
);
