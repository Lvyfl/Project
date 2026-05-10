"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.events = exports.postViews = exports.postLikes = exports.posts = exports.users = exports.departments = void 0;
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
    isMasterAdmin: (0, pg_core_1.boolean)('is_master_admin').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Posts table
exports.posts = (0, pg_core_1.pgTable)('posts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    departmentId: (0, pg_core_1.uuid)('department_id').references(() => exports.departments.id).notNull(),
    adminId: (0, pg_core_1.uuid)('admin_id').references(() => exports.users.id).notNull(),
    caption: (0, pg_core_1.text)('caption').notNull(),
    body: (0, pg_core_1.text)('body'),
    category: (0, pg_core_1.varchar)('category', { length: 100 }),
    imageUrl: (0, pg_core_1.text)('image_url'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.postLikes = (0, pg_core_1.pgTable)('post_likes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    postId: (0, pg_core_1.uuid)('post_id').references(() => exports.posts.id, { onDelete: 'cascade' }).notNull(),
    clientKey: (0, pg_core_1.varchar)('client_key', { length: 255 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    uniqPostClient: (0, pg_core_1.uniqueIndex)('post_likes_post_client_idx').on(table.postId, table.clientKey),
}));
exports.postViews = (0, pg_core_1.pgTable)('post_views', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    postId: (0, pg_core_1.uuid)('post_id').references(() => exports.posts.id, { onDelete: 'cascade' }).notNull(),
    clientKey: (0, pg_core_1.varchar)('client_key', { length: 255 }).notNull(),
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
    isAnnouncement: (0, pg_core_1.boolean)('is_announcement').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
