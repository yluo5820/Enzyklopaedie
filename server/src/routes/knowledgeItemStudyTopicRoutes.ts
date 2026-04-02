import { Router } from 'express';
import {
  assignStudyTopicToKnowledgeItem,
  getStudyTopicsByKnowledgeItem,
  removeStudyTopicFromKnowledgeItem,
} from '../controllers/knowledgeItemStudyTopicController';

const router = Router({ mergeParams: true });

router.get('/', getStudyTopicsByKnowledgeItem);
router.post('/', assignStudyTopicToKnowledgeItem);
router.delete('/:studyTopicId', removeStudyTopicFromKnowledgeItem);

export default router;
