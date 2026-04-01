import { Router } from 'express';
import { getAllActivityEvents } from '../controllers/activityEventController';

const router = Router();

router.get('/', getAllActivityEvents);

export default router;
