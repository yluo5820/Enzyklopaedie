import { Router } from 'express';
import {
  createStudyTopic,
  getAllStudyTopics,
  getKnowledgeItemsByStudyTopic,
  getStudyTopic,
} from '../controllers/studyTopicController';

const router = Router();

router.get('/', getAllStudyTopics);
router.get('/:id', getStudyTopic);
router.get('/:id/knowledge-items', getKnowledgeItemsByStudyTopic);
router.post('/', createStudyTopic);

export default router;
