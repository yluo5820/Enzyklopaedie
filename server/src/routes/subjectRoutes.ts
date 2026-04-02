import { Router } from 'express';
import {
  createSubject,
  deleteSubject,
  getAllSubjects,
  getKnowledgeItemsBySubject,
  getSubjectById,
  updateSubject,
} from '../controllers/subjectController';

const router = Router();

router.get('/', getAllSubjects);
router.get('/:id', getSubjectById);
router.get('/:id/knowledge-items', getKnowledgeItemsBySubject);
router.post('/', createSubject);
router.put('/:id', updateSubject);
router.delete('/:id', deleteSubject);

export default router;
