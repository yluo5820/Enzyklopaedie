import { Router } from 'express';
import {
  getAllNations,
  getNationById,
  createNation,
  updateNation,
  deleteNation,
} from '../controllers/nationController';

const router = Router();

router.get('/', getAllNations);
router.get('/:id', getNationById);
router.post('/', createNation);
router.put('/:id', updateNation);
router.delete('/:id', deleteNation);

export default router; 