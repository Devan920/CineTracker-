import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const leases = sqliteTable('leases', {
  key: text('key').primaryKey(),
  token: text('token').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
