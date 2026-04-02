import { Router } from 'express';
import {
  createStudyTopic,
  deleteStudyTopic,
  getAllStudyTopics,
  getKnowledgeItemsByStudyTopic,
  getStudyTopic,
} from '../controllers/studyTopicController';
import {
  createStudyTopicRelation,
  deleteStudyTopicRelation,
  getRelationsByStudyTopic,
} from '../controllers/studyTopicRelationController';

const router = Router();

router.get('/', getAllStudyTopics);
router.get('/:id', getStudyTopic);
router.get('/:id/knowledge-items', getKnowledgeItemsByStudyTopic);
router.get('/:id/relations', getRelationsByStudyTopic);
router.post('/', createStudyTopic);
router.post('/:id/relations', createStudyTopicRelation);
router.delete('/:id', deleteStudyTopic);
router.delete('/:id/relations/:relationId', deleteStudyTopicRelation);

export default router;
