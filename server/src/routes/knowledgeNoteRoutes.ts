import { Router } from 'express';
import {
  createKnowledgeNote,
  deleteKnowledgeNote,
  getKnowledgeNotesByItem,
  updateKnowledgeNote,
} from '../controllers/knowledgeNoteController';

const router = Router({ mergeParams: true });

router.get('/', getKnowledgeNotesByItem);
router.post('/', createKnowledgeNote);
router.put('/:id', updateKnowledgeNote);
router.delete('/:id', deleteKnowledgeNote);

export default router;
