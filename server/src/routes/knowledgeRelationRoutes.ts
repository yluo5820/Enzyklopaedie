import { Router } from 'express';
import {
  createKnowledgeRelation,
  deleteKnowledgeRelation,
  getRelationsByKnowledgeItem,
} from '../controllers/knowledgeRelationController';

const router = Router({ mergeParams: true });

router.get('/', getRelationsByKnowledgeItem);
router.post('/', createKnowledgeRelation);
router.delete('/:id', deleteKnowledgeRelation);

export default router;
