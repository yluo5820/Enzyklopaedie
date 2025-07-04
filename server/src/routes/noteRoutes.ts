import { Router } from 'express';
import {
  getAllNotes,
  getNoteById,
  getNotesByParent,
  createNote,
  updateNote,
  deleteNote,
} from '../controllers/noteController';

const router = Router();

router.get('/', getAllNotes);
router.get('/parent', getNotesByParent); // Query by parentId and parentType
router.get('/:id', getNoteById);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router; 