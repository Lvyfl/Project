import { pgTable, uuid, text, timestamp, varchar } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Posts table
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  departmentId: uuid('department_id').references(() => departments.id).notNull(),
  adminId: uuid('admin_id').references(() => users.id).notNull(),
  caption: text('caption').notNull(),
  imageUrl: text('image_url'),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
