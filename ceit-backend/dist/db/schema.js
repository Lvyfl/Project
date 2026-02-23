"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.events = exports.posts = exports.users = exports.departments = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Departments table
exports.departments = (0, pg_core_1.pgTable)('departments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Users table (Admins)
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => exports.departments.id).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    password: (0, pg_core_1.text)('password').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Posts table
exports.posts = (0, pg_core_1.pgTable)('posts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => exports.departments.id).notNull(),
    adminId: (0, pg_core_1.uuid)('admin_id').references(() => exports.users.id).notNull(),
    caption: (0, pg_core_1.text)('caption').notNull(),
    imageUrl: (0, pg_core_1.text)('image_url'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Events table
exports.events = (0, pg_core_1.pgTable)('events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => exports.departments.id).notNull(),
    adminId: (0, pg_core_1.uuid)('admin_id').references(() => exports.users.id).notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    eventDate: (0, pg_core_1.timestamp)('event_date').notNull(),
    endDate: (0, pg_core_1.timestamp)('end_date'),
    location: (0, pg_core_1.varchar)('location', { length: 255 }),
    eventImageUrl: (0, pg_core_1.text)('event_image_url'),
    eventLink: (0, pg_core_1.text)('event_link'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
