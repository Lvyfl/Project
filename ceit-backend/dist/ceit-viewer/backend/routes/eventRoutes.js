"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("../controllers/eventController");
const authMiddleware_1 = require("../../../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public route - no authentication required (used by viewer.html)
router.get('/public', eventController_1.getPublicEvents);
// All event routes require authentication
router.use(authMiddleware_1.authenticateToken);
router.post('/', eventController_1.createEvent);
router.get('/', eventController_1.getEvents);
router.get('/:id', eventController_1.getEventById);
router.put('/:id', eventController_1.updateEvent);
router.delete('/:id', eventController_1.deleteEvent);
exports.default = router;
