import { Router } from 'express';
import {
  createTopic,
  getAllTopics,
  getKnowledgeItemsByTopic,
  getTopicById,
} from '../controllers/topicController';

const router = Router();

router.get('/', getAllTopics);
router.get('/:id', getTopicById);
router.get('/:id/knowledge-items', getKnowledgeItemsByTopic);
router.post('/', createTopic);

export default router;
