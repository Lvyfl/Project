import { Request, Response } from 'express';
import { db } from '../db';
import { users, departments } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const getDepartments = async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const MASTER_ADMIN_EMAIL = 'lori04@gmail.com';

export const register = async (req: any, res: Response) => {
  try {
    // Only the master admin account may create new admin accounts
    if (!req.user?.isMasterAdmin) {
      return res.status(403).json({ error: 'Only the master admin can create new admin accounts.' });
    }

    const { name, email, password, departmentName } = req.body;

    // Find department by department name
    const [department] = await db.select().from(departments).where(eq(departments.name, departmentName));
    if (!department) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      departmentId: department.id,
      isMasterAdmin: false,
    }).returning();

    res.status(201).json({ message: 'Admin registered successfully', user: { id: newUser.id, name: newUser.name, email: newUser.email, departmentId: newUser.departmentId } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdmins = async (req: any, res: Response) => {
  try {
    if (!req.user?.isMasterAdmin) {
      return res.status(403).json({ error: 'Only the master admin can view admin accounts.' });
    }
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isMasterAdmin: users.isMasterAdmin,
        createdAt: users.createdAt,
        departmentId: users.departmentId,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .orderBy(asc(users.createdAt));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAdmin = async (req: any, res: Response) => {
  try {
    if (!req.user?.isMasterAdmin) {
      return res.status(403).json({ error: 'Only the master admin can delete admin accounts.' });
    }
    const { id } = req.params;
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.email === MASTER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot delete the master admin account.' });
    }
    await db.delete(users).where(eq(users.id, id));
    res.json({ message: 'Admin deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAdmin = async (req: any, res: Response) => {
  try {
    if (!req.user?.isMasterAdmin) {
      return res.status(403).json({ error: 'Only the master admin can update admin accounts.' });
    }
    const { id } = req.params;
    const { name, email, password, departmentName } = req.body;

    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.email === MASTER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot edit the master admin account.' });
    }

    // Resolve department
    const [department] = await db.select().from(departments).where(eq(departments.name, departmentName));
    if (!department) return res.status(400).json({ error: 'Invalid department.' });

    const updates: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      departmentId: department.id,
    };

    if (password && password.length >= 6) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    res.json({ message: 'Admin updated successfully.', user: { id: updated.id, name: updated.name, email: updated.email, departmentId: updated.departmentId } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Ensure lori04@gmail.com is always flagged as master admin after login
export { MASTER_ADMIN_EMAIL };

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Ensure the master admin flag is always in sync (in case the row was seeded manually)
    if (user.email === MASTER_ADMIN_EMAIL && !user.isMasterAdmin) {
      await db.update(users).set({ isMasterAdmin: true }).where(eq(users.id, user.id));
      user.isMasterAdmin = true;
    }

    const token = jwt.sign(
      { userId: user.id, departmentId: user.departmentId, email: user.email, isMasterAdmin: user.isMasterAdmin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, departmentId: user.departmentId, isMasterAdmin: user.isMasterAdmin } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
