import { Router } from 'express';
import {
  getAllKnowledgeItems,
  getKnowledgeItemById,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
} from '../controllers/knowledgeItemController';

const router = Router();

router.get('/', getAllKnowledgeItems);
router.get('/:id', getKnowledgeItemById);
router.post('/', createKnowledgeItem);
router.put('/:id', updateKnowledgeItem);
router.delete('/:id', deleteKnowledgeItem);

export default router;
