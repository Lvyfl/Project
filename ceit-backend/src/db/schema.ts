import { pgTable, uuid, text, timestamp, varchar, uniqueIndex, boolean, index } from 'drizzle-orm/pg-core';



// Departments table

export const departments = pgTable('departments', {

  id: uuid('id').primaryKey().defaultRandom(),

  name: varchar('name', { length: 255 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});



// Users table (Admins)

export const users = pgTable('users', {

  id: uuid('id').primaryKey().defaultRandom(),

  departmentId: uuid('department_id').references(() => departments.id).notNull(),

  name: varchar('name', { length: 255 }).notNull(),

  email: varchar('email', { length: 255 }).notNull().unique(),

  password: text('password').notNull(),

  isMasterAdmin: boolean('is_master_admin').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});



// Posts table

export const posts = pgTable('posts', {

  id: uuid('id').primaryKey().defaultRandom(),

  departmentId: uuid('department_id').references(() => departments.id).notNull(),

  adminId: uuid('admin_id').references(() => users.id).notNull(),

  caption: text('caption').notNull(),

  body: text('body'),

  category: varchar('category', { length: 100 }),

  imageUrl: text('image_url'),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});



export const postLikes = pgTable('post_likes', {

  id: uuid('id').primaryKey().defaultRandom(),

  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),

  clientKey: varchar('client_key', { length: 255 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

}, (table) => ({

  uniqPostClient: uniqueIndex('post_likes_post_client_idx').on(table.postId, table.clientKey),

}));



export const postViews = pgTable('post_views', {

  id: uuid('id').primaryKey().defaultRandom(),

  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),

  clientKey: varchar('client_key', { length: 255 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});



// Events table

export const events = pgTable('events', {

  id: uuid('id').primaryKey().defaultRandom(),

  departmentId: uuid('department_id').references(() => departments.id).notNull(),

  adminId: uuid('admin_id').references(() => users.id).notNull(),

  title: varchar('title', { length: 255 }).notNull(),

  description: text('description'),

  eventDate: timestamp('event_date').notNull(),

  endDate: timestamp('end_date'),

  location: varchar('location', { length: 255 }),

  eventImageUrl: text('event_image_url'),

  eventLink: text('event_link'),

  isAnnouncement: boolean('is_announcement').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 30 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  actorAdminId: uuid('actor_admin_id').references(() => users.id).notNull(),
  actorName: varchar('actor_name', { length: 255 }).notNull(),
  actorEmail: varchar('actor_email', { length: 255 }).notNull(),
  actorIsMasterAdmin: boolean('actor_is_master_admin').default(false).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  departmentIdIdx: index('audit_logs_department_id_idx').on(table.departmentId),
  entityTypeIdx: index('audit_logs_resource_type_idx').on(table.entityType),
}));

