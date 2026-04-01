import { Router } from 'express';
import {
  assignTopicToKnowledgeItem,
  getTopicsByKnowledgeItem,
  removeTopicFromKnowledgeItem,
} from '../controllers/knowledgeItemTopicController';

const router = Router({ mergeParams: true });

router.get('/', getTopicsByKnowledgeItem);
router.post('/', assignTopicToKnowledgeItem);
router.delete('/:topicId', removeTopicFromKnowledgeItem);

export default router;
