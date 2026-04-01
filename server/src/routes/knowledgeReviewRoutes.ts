import { Router } from 'express';
import {
  createKnowledgeReview,
  deleteKnowledgeReview,
  getKnowledgeReviewsByItem,
  updateKnowledgeReview,
} from '../controllers/knowledgeReviewController';

const router = Router({ mergeParams: true });

router.get('/', getKnowledgeReviewsByItem);
router.post('/', createKnowledgeReview);
router.put('/:id', updateKnowledgeReview);
router.delete('/:id', deleteKnowledgeReview);

export default router;
