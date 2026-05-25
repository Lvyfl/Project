"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.MASTER_ADMIN_EMAIL = exports.updateAdmin = exports.deleteAdmin = exports.getAdmins = exports.register = exports.getDepartments = void 0;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auditLogger_1 = require("../utils/auditLogger");
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const getDepartments = async (_req, res) => {
    try {
        const rows = await db_1.db
            .select({ id: schema_1.departments.id, name: schema_1.departments.name })
            .from(schema_1.departments)
            .orderBy((0, drizzle_orm_1.asc)(schema_1.departments.name));
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDepartments = getDepartments;
const MASTER_ADMIN_EMAIL = 'lori04@gmail.com';
exports.MASTER_ADMIN_EMAIL = MASTER_ADMIN_EMAIL;
const register = async (req, res) => {
    try {
        // Only the master admin account may create new admin accounts
        if (!req.user?.isMasterAdmin) {
            return res.status(403).json({ error: 'Only the master admin can create new admin accounts.' });
        }
        const { name, email, password, departmentName } = req.body;
        // Find department by department name
        const [department] = await db_1.db.select().from(schema_1.departments).where((0, drizzle_orm_1.eq)(schema_1.departments.name, departmentName));
        if (!department) {
            return res.status(400).json({ error: 'Invalid department' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const [newUser] = await db_1.db.insert(schema_1.users).values({
            name,
            email,
            password: hashedPassword,
            departmentId: department.id,
            isMasterAdmin: false,
        }).returning();
        await (0, auditLogger_1.createAuditLogEntry)({
            action: 'create',
            resourceType: 'admin',
            resourceId: newUser.id,
            departmentId: newUser.departmentId,
            actorId: req.user.userId,
            title: newUser.name,
            description: 'Created admin account',
            category: null,
            imageUrl: null,
        });
        res.status(201).json({ message: 'Admin registered successfully', user: { id: newUser.id, name: newUser.name, email: newUser.email, departmentId: newUser.departmentId } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.register = register;
const getAdmins = async (req, res) => {
    try {
        if (!req.user?.isMasterAdmin) {
            return res.status(403).json({ error: 'Only the master admin can view admin accounts.' });
        }
        const rows = await db_1.db
            .select({
            id: schema_1.users.id,
            name: schema_1.users.name,
            email: schema_1.users.email,
            isMasterAdmin: schema_1.users.isMasterAdmin,
            createdAt: schema_1.users.createdAt,
            departmentId: schema_1.users.departmentId,
            departmentName: schema_1.departments.name,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.users.departmentId, schema_1.departments.id))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.users.createdAt));
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAdmins = getAdmins;
const deleteAdmin = async (req, res) => {
    try {
        if (!req.user?.isMasterAdmin) {
            return res.status(403).json({ error: 'Only the master admin can delete admin accounts.' });
        }
        const { id } = req.params;
        const [target] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        if (!target)
            return res.status(404).json({ error: 'User not found.' });
        if (target.email === MASTER_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Cannot delete the master admin account.' });
        }
        await db_1.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        await (0, auditLogger_1.createAuditLogEntry)({
            action: 'delete',
            resourceType: 'admin',
            resourceId: target.id,
            departmentId: target.departmentId,
            actorId: req.user.userId,
            title: target.name,
            description: 'Deleted admin account',
            category: null,
            imageUrl: null,
        });
        res.json({ message: 'Admin deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteAdmin = deleteAdmin;
const updateAdmin = async (req, res) => {
    try {
        if (!req.user?.isMasterAdmin) {
            return res.status(403).json({ error: 'Only the master admin can update admin accounts.' });
        }
        const { id } = req.params;
        const { name, email, password, departmentName } = req.body;
        const [target] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        if (!target)
            return res.status(404).json({ error: 'User not found.' });
        if (target.email === MASTER_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Cannot edit the master admin account.' });
        }
        // Resolve department
        const [department] = await db_1.db.select().from(schema_1.departments).where((0, drizzle_orm_1.eq)(schema_1.departments.name, departmentName));
        if (!department)
            return res.status(400).json({ error: 'Invalid department.' });
        const updates = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            departmentId: department.id,
        };
        if (password && password.length >= 6) {
            updates.password = await bcryptjs_1.default.hash(password, 10);
        }
        const [updated] = await db_1.db.update(schema_1.users).set(updates).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).returning();
        await (0, auditLogger_1.createAuditLogEntry)({
            action: 'update',
            resourceType: 'admin',
            resourceId: updated.id,
            departmentId: updated.departmentId,
            actorId: req.user.userId,
            title: updated.name,
            description: 'Updated admin account',
            category: null,
            imageUrl: null,
        });
        res.json({ message: 'Admin updated successfully.', user: { id: updated.id, name: updated.name, email: updated.email, departmentId: updated.departmentId } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateAdmin = updateAdmin;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Ensure the master admin flag is always in sync (in case the row was seeded manually)
        if (user.email === MASTER_ADMIN_EMAIL && !user.isMasterAdmin) {
            await db_1.db.update(schema_1.users).set({ isMasterAdmin: true }).where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
            user.isMasterAdmin = true;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, departmentId: user.departmentId, email: user.email, isMasterAdmin: user.isMasterAdmin }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, departmentId: user.departmentId, isMasterAdmin: user.isMasterAdmin } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.login = login;
