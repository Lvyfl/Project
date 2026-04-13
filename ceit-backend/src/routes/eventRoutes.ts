import { Router } from 'express';
import {
	createEvent,
	getEvents,
	getPublicEvents,
	getEventById,
	updateEvent,
	deleteEvent,
} from '../controllers/eventController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/public', getPublicEvents);

router.use(authenticateToken);

router.post('/', createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export default router;
