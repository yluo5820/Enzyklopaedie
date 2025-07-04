import { Router } from 'express';
import {
  getAllComments,
  getCommentById,
  getCommentsByParent,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController';

const router = Router();

router.get('/', getAllComments);
router.get('/parent', getCommentsByParent); // Query by parentId and parentType
router.get('/:id', getCommentById);
router.post('/', createComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);

export default router; 