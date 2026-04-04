import { Router } from 'express';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  getAllReferenceEntities,
  getPolitySnapshotsByReferenceEntity,
  getReferenceEntityById,
  getRelationsByReferenceEntity,
  updateReferenceEntity,
} from '../controllers/referenceEntityController';
import {
  createFormationMembership,
  deleteFormationMembership,
  getFormationMembershipsByReferenceEntity,
} from '../controllers/formationMembershipController';
import {
  createReferenceEntityRelation,
  deleteReferenceEntityRelation,
  getOutgoingRelationsByReferenceEntity,
} from '../controllers/referenceEntityRelationController';

const router = Router();

router.get('/', getAllReferenceEntities);
router.get('/:id/formation-memberships', getFormationMembershipsByReferenceEntity);
router.get('/:id/relations', getRelationsByReferenceEntity);
router.get('/:id/polity-snapshots', getPolitySnapshotsByReferenceEntity);
router.get('/:id/outgoing-relations', getOutgoingRelationsByReferenceEntity);
router.get('/:id', getReferenceEntityById);
router.post('/', createReferenceEntity);
router.post('/:id/formation-memberships', createFormationMembership);
router.post('/:id/outgoing-relations', createReferenceEntityRelation);
router.put('/:id', updateReferenceEntity);
router.delete('/:id/formation-memberships/:membershipId', deleteFormationMembership);
router.delete('/:id/outgoing-relations/:relationId', deleteReferenceEntityRelation);
router.delete('/:id', deleteReferenceEntity);

export default router;
