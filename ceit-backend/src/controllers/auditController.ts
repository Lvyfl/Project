import { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, departments } from '../db/schema';

function iconForEntity(resourceType: string, isAnnouncement: boolean) {
  if (resourceType === 'event') {
    return isAnnouncement ? '📣' : '🗓️';
  }
  if (resourceType === 'admin') {
    return '👤';
  }
  return '📄';
}

export const getAuditLogs = async (req: any, res: Response) => {
  try {
    const { isMasterAdmin, departmentId } = req.user;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const resourceType = typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;

    const conditions = [] as ReturnType<typeof eq>[];
    if (!isMasterAdmin) {
      conditions.push(eq(auditLogs.departmentId, departmentId));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.entityType, resourceType));
    }
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    const rows = await db
      .select({
        auditLog: auditLogs,
        departmentName: departments.name,
      })
      .from(auditLogs)
      .leftJoin(departments, eq(auditLogs.departmentId, departments.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
