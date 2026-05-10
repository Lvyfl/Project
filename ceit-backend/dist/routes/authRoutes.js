"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get('/departments', authController_1.getDepartments); // public
router.post('/login', authController_1.login); // public
router.post('/register', authMiddleware_1.authenticateToken, authController_1.register); // master admin only
router.get('/admins', authMiddleware_1.authenticateToken, authController_1.getAdmins); // master admin only
router.delete('/admins/:id', authMiddleware_1.authenticateToken, authController_1.deleteAdmin); // master admin only
router.patch('/admins/:id', authMiddleware_1.authenticateToken, authController_1.updateAdmin); // master admin only
exports.default = router;
