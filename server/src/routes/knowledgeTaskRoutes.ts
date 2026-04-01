import { Router } from 'express';
import {
  createKnowledgeTask,
  deleteKnowledgeTask,
  getKnowledgeTasksByItem,
  updateKnowledgeTask,
} from '../controllers/knowledgeTaskController';

const router = Router({ mergeParams: true });

router.get('/', getKnowledgeTasksByItem);
router.post('/', createKnowledgeTask);
router.put('/:id', updateKnowledgeTask);
router.delete('/:id', deleteKnowledgeTask);

export default router;
