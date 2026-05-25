import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, users } from '../db/schema';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditResourceType = 'post' | 'event' | 'admin';

export interface AuditLogInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  departmentId?: string | null;
  actorId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
}

async function resolveActor(actorId: string) {
  const [actor] = await db
    .select({
      name: users.name,
      email: users.email,
      isMasterAdmin: users.isMasterAdmin,
    })
    .from(users)
    .where(eq(users.id, actorId));

  return {
    name: actor?.name || 'Unknown Admin',
    email: actor?.email || 'unknown@system',
    isMasterAdmin: actor?.isMasterAdmin ?? false,
  };
}

export async function createAuditLogEntry(input: AuditLogInput) {
  const actor = await resolveActor(input.actorId);

  const [entry] = await db
    .insert(auditLogs)
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
