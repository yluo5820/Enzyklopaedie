import { Router } from 'express';
import { resetDevelopmentData } from '../controllers/devController';

const router = Router();

router.post('/reset', resetDevelopmentData);

export default router;
