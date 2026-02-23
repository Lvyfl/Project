import { Request, Response } from 'express';
import { db, pool } from '../../../db';
import { events, users, departments } from '../../../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

let eventColumnsEnsured = false;

async function ensureEventMediaColumns() {
  if (eventColumnsEnsured) return;

  await pool.query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS event_image_url text,
      ADD COLUMN IF NOT EXISTS event_link text;
  `);

  eventColumnsEnsured = true;
}

async function purgeExpiredEvents() {
  await pool.query(`
    DELETE FROM events
    WHERE DATE(COALESCE(end_date, event_date)) < CURRENT_DATE;
  `);
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Create a new event
export const createEvent = async (req: any, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { title, description, eventDate, endDate, location, eventImageUrl, eventLink } = req.body;
    const { userId, departmentId } = req.user;

    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }

    // Validate that event date is strictly in the future (after today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDateObj = new Date(eventDate);
    const eventDateOnly = new Date(eventDateObj);
    eventDateOnly.setHours(0, 0, 0, 0);
    if (eventDateOnly <= today) {
      return res.status(400).json({ error: 'Event date must be a future date (after today)' });
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      const endDateOnly = new Date(endDateObj);
      endDateOnly.setHours(0, 0, 0, 0);
      if (endDateOnly <= today) {
        return res.status(400).json({ error: 'End date must be a future date (after today)' });
      }
    }

    if (eventLink && !isValidUrl(String(eventLink))) {
      return res.status(400).json({ error: 'Event link must be a valid http/https URL' });
    }

    if (eventImageUrl && String(eventImageUrl).length > 6_000_000) {
      return res.status(400).json({ error: 'Event image is too large' });
    }

    const [newEvent] = await db.insert(events).values({
      title,
      description,
      eventDate: new Date(eventDate),
      endDate: endDate ? new Date(endDate) : null,
      location,
      eventImageUrl: eventImageUrl || null,
      eventLink: eventLink || null,
      adminId: userId,
      departmentId: departmentId,
    }).returning();

    res.status(201).json(newEvent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all events (for authenticated admins)
export const getEvents = async (req: any, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { departmentId } = req.user;
    const { startDate, endDate, allDepartments } = req.query;

    let query = db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        endDate: events.endDate,
        location: events.location,
        eventImageUrl: events.eventImageUrl,
        eventLink: events.eventLink,
        createdAt: events.createdAt,
        adminName: users.name,
        departmentName: departments.name,
        departmentId: events.departmentId,
      })
      .from(events)
      .leftJoin(users, eq(events.adminId, users.id))
      .leftJoin(departments, eq(events.departmentId, departments.id))
      .orderBy(events.eventDate);

    // Build where conditions
    const conditions = [];

    // Filter by department unless allDepartments is specified
    if (!allDepartments || allDepartments === 'false') {
      conditions.push(eq(events.departmentId, departmentId));
    }

    // Filter by date range if provided
    if (startDate) {
      conditions.push(gte(events.eventDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(events.eventDate, new Date(endDate as string)));
    }

    if (conditions.length > 0) {
      const allEvents = await query.where(and(...conditions));
      return res.json(allEvents);
    }

    const allEvents = await query;
    res.json(allEvents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Public: Get events without authentication (for viewer.html)
export const getPublicEvents = async (req: Request, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { startDate, endDate, departmentId } = req.query;

    let query = db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        endDate: events.endDate,
        location: events.location,
        eventImageUrl: events.eventImageUrl,
        eventLink: events.eventLink,
        createdAt: events.createdAt,
        adminName: users.name,
        departmentName: departments.name,
        departmentId: events.departmentId,
      })
      .from(events)
      .leftJoin(users, eq(events.adminId, users.id))
      .leftJoin(departments, eq(events.departmentId, departments.id))
      .orderBy(events.eventDate);

    const conditions = [];
    if (departmentId && typeof departmentId === 'string') {
      conditions.push(eq(events.departmentId, departmentId));
    }
    if (startDate) {
      conditions.push(gte(events.eventDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(events.eventDate, new Date(endDate as string)));
    }

    if (conditions.length > 0) {
      const publicEvents = await query.where(and(...conditions));
      return res.json(publicEvents);
    }

    const publicEvents = await query;
    res.json(publicEvents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single event by ID
export const getEventById = async (req: any, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { id } = req.params;

    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        endDate: events.endDate,
        location: events.location,
        eventImageUrl: events.eventImageUrl,
        eventLink: events.eventLink,
        createdAt: events.createdAt,
        adminName: users.name,
        departmentName: departments.name,
        departmentId: events.departmentId,
      })
      .from(events)
      .leftJoin(users, eq(events.adminId, users.id))
      .leftJoin(departments, eq(events.departmentId, departments.id))
      .where(eq(events.id, id));

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update an event
export const updateEvent = async (req: any, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { id } = req.params;
    const { title, description, eventDate, endDate, location, eventImageUrl, eventLink } = req.body;
    const { userId, departmentId } = req.user;

    // Ensure the event belongs to the admin's department
    const [existingEvent] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.departmentId, departmentId)));

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found or unauthorized' });
    }

    if (eventLink !== undefined && eventLink && !isValidUrl(String(eventLink))) {
      return res.status(400).json({ error: 'Event link must be a valid http/https URL' });
    }

    if (eventImageUrl !== undefined && eventImageUrl && String(eventImageUrl).length > 6_000_000) {
      return res.status(400).json({ error: 'Event image is too large' });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (eventDate) updateData.eventDate = new Date(eventDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (location !== undefined) updateData.location = location;
    if (eventImageUrl !== undefined) updateData.eventImageUrl = eventImageUrl || null;
    if (eventLink !== undefined) updateData.eventLink = eventLink || null;

    const [updatedEvent] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    res.json(updatedEvent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete an event
export const deleteEvent = async (req: any, res: Response) => {
  try {
    await ensureEventMediaColumns();
    await purgeExpiredEvents();

    const { id } = req.params;
    const { departmentId } = req.user;

    // Ensure the event belongs to the admin's department
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.departmentId, departmentId)));

    if (!event) {
      return res.status(404).json({ error: 'Event not found or unauthorized' });
    }

    await db.delete(events).where(eq(events.id, id));

    res.json({ message: 'Event deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
