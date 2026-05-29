import { Router } from 'express';
import {
  createReferenceEntity,
  deleteReferenceEntity,
  getAllReferenceEntities,
  getPolitySnapshotsByReferenceEntity,
  getReferenceEntityById,
  getRelationsByReferenceEntity,
  importReferenceEntityAuthority,
  searchReferenceEntityAuthority,
  updateReferenceEntity,
} from '../controllers/referenceEntityController';
import {
  createFormationMembership,
  deleteFormationMembership,
  getFormationMembershipsByReferenceEntity,
} from '../controllers/formationMembershipController';
import {
  createPersonPolityMembership,
  deletePersonPolityMembership,
  getPersonPolityMembershipsByReferenceEntity,
} from '../controllers/personPolityMembershipController';
import {
  createPersonSubjectMembership,
  deletePersonSubjectMembership,
  getPersonSubjectMembershipsByReferenceEntity,
} from '../controllers/personSubjectMembershipController';
import {
  createReferenceEntityRelation,
  deleteReferenceEntityRelation,
  getOutgoingRelationsByReferenceEntity,
} from '../controllers/referenceEntityRelationController';

const router = Router();

router.get('/', getAllReferenceEntities);
router.get('/authority-search', searchReferenceEntityAuthority);
router.get('/:id/formation-memberships', getFormationMembershipsByReferenceEntity);
router.get('/:id/person-polity-memberships', getPersonPolityMembershipsByReferenceEntity);
router.get('/:id/person-subject-memberships', getPersonSubjectMembershipsByReferenceEntity);
router.get('/:id/relations', getRelationsByReferenceEntity);
router.get('/:id/polity-snapshots', getPolitySnapshotsByReferenceEntity);
router.get('/:id/outgoing-relations', getOutgoingRelationsByReferenceEntity);
router.get('/:id', getReferenceEntityById);
router.post('/', createReferenceEntity);
router.post('/authority-import', importReferenceEntityAuthority);
router.post('/:id/formation-memberships', createFormationMembership);
router.post('/:id/person-polity-memberships', createPersonPolityMembership);
router.post('/:id/person-subject-memberships', createPersonSubjectMembership);
router.post('/:id/outgoing-relations', createReferenceEntityRelation);
router.put('/:id', updateReferenceEntity);
router.delete('/:id/formation-memberships/:membershipId', deleteFormationMembership);
router.delete('/:id/person-polity-memberships/:membershipId', deletePersonPolityMembership);
router.delete('/:id/person-subject-memberships/:membershipId', deletePersonSubjectMembership);
router.delete('/:id/outgoing-relations/:relationId', deleteReferenceEntityRelation);
router.delete('/:id', deleteReferenceEntity);

export default router;
