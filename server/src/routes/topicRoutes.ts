import { Router } from 'express';
import {
  createTopic,
  deleteTopic,
  getAllTopics,
  getKnowledgeItemsByTopic,
  getTopicById,
} from '../controllers/topicController';
import {
  createTopicRelation,
  deleteTopicRelation,
  getRelationsByTopic,
} from '../controllers/topicRelationController';

const router = Router();

router.get('/', getAllTopics);
router.get('/:id', getTopicById);
router.get('/:id/knowledge-items', getKnowledgeItemsByTopic);
router.get('/:id/relations', getRelationsByTopic);
router.post('/', createTopic);
router.post('/:id/relations', createTopicRelation);
router.delete('/:id', deleteTopic);
router.delete('/:id/relations/:relationId', deleteTopicRelation);

export default router;
