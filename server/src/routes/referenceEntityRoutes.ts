import { Router } from 'express';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  getAllReferenceEntities,
  getReferenceEntityById,
  getRelationsByReferenceEntity,
  updateReferenceEntity,
} from '../controllers/referenceEntityController';
import {
  createReferenceEntityRelation,
  deleteReferenceEntityRelation,
  getOutgoingRelationsByReferenceEntity,
} from '../controllers/referenceEntityRelationController';

const router = Router();

router.get('/', getAllReferenceEntities);
router.get('/:id/relations', getRelationsByReferenceEntity);
router.get('/:id/outgoing-relations', getOutgoingRelationsByReferenceEntity);
router.get('/:id', getReferenceEntityById);
router.post('/', createReferenceEntity);
router.post('/:id/outgoing-relations', createReferenceEntityRelation);
router.put('/:id', updateReferenceEntity);
router.delete('/:id/outgoing-relations/:relationId', deleteReferenceEntityRelation);
router.delete('/:id', deleteReferenceEntity);

export default router;
