"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLogEntry = createAuditLogEntry;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
async function resolveActor(actorId) {
    const [actor] = await db_1.db
        .select({
        name: schema_1.users.name,
        email: schema_1.users.email,
        isMasterAdmin: schema_1.users.isMasterAdmin,
    })
        .from(schema_1.users)
        .where((0, drizzle_orm_1.eq)(schema_1.users.id, actorId));
    return {
        name: actor?.name || 'Unknown Admin',
        email: actor?.email || 'unknown@system',
        isMasterAdmin: actor?.isMasterAdmin ?? false,
    };
}
async function createAuditLogEntry(input) {
    const actor = await resolveActor(input.actorId);
    const [entry] = await db_1.db
        .insert(schema_1.auditLogs)
        .values({
        action: input.action,
        entityType: input.resourceType,
        entityId: input.resourceId,
        departmentId: input.departmentId || null,
        actorAdminId: input.actorId,
        actorName: actor.name,
        actorEmail: actor.email,
        actorIsMasterAdmin: actor.isMasterAdmin,
        title: input.title,
        description: input.description || null,
        category: input.category || null,
        imageUrl: input.imageUrl || null,
    })
        .returning();
    return entry;
}
