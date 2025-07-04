import { Router } from 'express';
import {
  getAllCivilizations,
  getCivilizationById,
  createCivilization,
  updateCivilization,
  deleteCivilization,
} from '../controllers/civilizationController';

const router = Router();

router.get('/', getAllCivilizations);
router.get('/:id', getCivilizationById);
router.post('/', createCivilization);
router.put('/:id', updateCivilization);
router.delete('/:id', deleteCivilization);

export default router; 