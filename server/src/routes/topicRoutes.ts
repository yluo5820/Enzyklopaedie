import { Router } from 'express';
import {
  createTopic,
  deleteTopic,
  getAllTopics,
  getKnowledgeItemsByTopic,
  getTopicById,
  updateTopic,
} from '../controllers/topicController';

const router = Router();

router.get('/', getAllTopics);
router.get('/:id', getTopicById);
router.get('/:id/knowledge-items', getKnowledgeItemsByTopic);
router.post('/', createTopic);
router.put('/:id', updateTopic);
router.delete('/:id', deleteTopic);

export default router;
