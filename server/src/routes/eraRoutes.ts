import { Router } from 'express';
import {
  getAllEras,
  getEraById,
  createEra,
  updateEra,
  deleteEra,
} from '../controllers/eraController';

const router = Router();

router.get('/', getAllEras);
router.get('/:id', getEraById);
router.post('/', createEra);
router.put('/:id', updateEra);
router.delete('/:id', deleteEra);

export default router; 