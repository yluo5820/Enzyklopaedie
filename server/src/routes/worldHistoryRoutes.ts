import { Router } from 'express';
import {
  createCanonicalHistoricalEntity,
  deleteCanonicalHistoricalEntity,
  getCanonicalHistoricalEntities,
  getCanonicalHistoricalEntityById,
  promoteCanonicalHistoricalEntity,
  searchCanonicalHistoricalEntities,
} from '../controllers/worldHistoryController';

const router = Router();

router.get('/entities', getCanonicalHistoricalEntities);
router.get('/entities/:id', getCanonicalHistoricalEntityById);
router.post('/entities', createCanonicalHistoricalEntity);
router.post('/entities/:id/promote', promoteCanonicalHistoricalEntity);
router.delete('/entities/:id', deleteCanonicalHistoricalEntity);
router.get('/search', searchCanonicalHistoricalEntities);

export default router;
