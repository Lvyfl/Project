"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
function iconForEntity(resourceType, isAnnouncement) {
    if (resourceType === 'event') {
        return isAnnouncement ? '📣' : '🗓️';
    }
    if (resourceType === 'admin') {
        return '👤';
    }
    return '📄';
}
const getAuditLogs = async (req, res) => {
    try {
        const { isMasterAdmin, departmentId } = req.user;
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const resourceType = typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined;
        const action = typeof req.query.action === 'string' ? req.query.action : undefined;
        const conditions = [];
        if (!isMasterAdmin) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.auditLogs.departmentId, departmentId));
        }
        if (resourceType) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.auditLogs.entityType, resourceType));
        }
        if (action) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.auditLogs.action, action));
        }
        const rows = await db_1.db
            .select({
            auditLog: schema_1.auditLogs,
            departmentName: schema_1.departments.name,
        })
            .from(schema_1.auditLogs)
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.auditLogs.departmentId, schema_1.departments.id))
            .where(conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLogs.createdAt))
            .limit(limit)
            .offset(offset);
        const payload = rows.map((row) => {
            const audit = row.auditLog;
            const badge = audit.action === 'delete' ? 'Deleted' : audit.action === 'update' ? 'Updated' : 'Created';
            return {
                id: audit.id,
                resourceType: audit.entityType,
                action: audit.action,
                resourceId: audit.entityId,
                createdAt: audit.createdAt,
                departmentName: row.departmentName || 'Unknown department',
                actorName: audit.actorName,
                actorEmail: audit.actorEmail,
                title: audit.title,
                description: audit.description || (audit.entityType === 'event' ? 'No description' : 'No body text'),
                badge,
                icon: iconForEntity(audit.entityType, audit.category === 'Announcement'),
            };
        });
        res.json(payload);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAuditLogs = getAuditLogs;
