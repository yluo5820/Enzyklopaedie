import { Router } from 'express';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  getAllReferenceEntities,
  getReferenceEntityById,
  updateReferenceEntity,
} from '../controllers/referenceEntityController';

const router = Router();

router.get('/', getAllReferenceEntities);
router.get('/:id', getReferenceEntityById);
router.post('/', createReferenceEntity);
router.put('/:id', updateReferenceEntity);
router.delete('/:id', deleteReferenceEntity);

export default router;
