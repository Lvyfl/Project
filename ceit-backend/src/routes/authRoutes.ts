import { Router } from 'express';
import { login, register, getDepartments, getAdmins, deleteAdmin, updateAdmin } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/departments', getDepartments);                       // public
router.post('/login', login);                                     // public
router.post('/register', authenticateToken, register);            // master admin only
router.get('/admins', authenticateToken, getAdmins);              // master admin only
router.delete('/admins/:id', authenticateToken, deleteAdmin);     // master admin only
router.patch('/admins/:id', authenticateToken, updateAdmin);       // master admin only

export default router;
