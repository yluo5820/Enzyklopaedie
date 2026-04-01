import { Router } from 'express';
import { createTopic, getAllTopics } from '../controllers/topicController';

const router = Router();

router.get('/', getAllTopics);
router.post('/', createTopic);

export default router;
