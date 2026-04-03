import { Router } from 'express';
import {
  createCanonicalHistoricalEntity,
  deleteCanonicalHistoricalEntity,
  getCanonicalHistoricalEntities,
  getCanonicalHistoricalEntityById,
  getCanonicalHistoricalEntityGeometry,
  promoteCanonicalHistoricalEntity,
  searchCanonicalHistoricalEntities,
} from '../controllers/worldHistoryController';

const router = Router();

router.get('/entities', getCanonicalHistoricalEntities);
router.get('/entities/:id', getCanonicalHistoricalEntityById);
router.get('/entities/:id/geometry', getCanonicalHistoricalEntityGeometry);
router.post('/entities', createCanonicalHistoricalEntity);
router.post('/entities/:id/promote', promoteCanonicalHistoricalEntity);
router.delete('/entities/:id', deleteCanonicalHistoricalEntity);
router.get('/search', searchCanonicalHistoricalEntities);

export default router;
