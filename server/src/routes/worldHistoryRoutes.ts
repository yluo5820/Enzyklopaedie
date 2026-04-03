import { Router } from 'express';
import {
  createCanonicalHistoricalEntity,
  deleteCanonicalHistoricalEntity,
  getCanonicalHistoricalEntities,
  getCanonicalHistoricalEntityById,
  searchCanonicalHistoricalEntities,
} from '../controllers/worldHistoryController';

const router = Router();

router.get('/entities', getCanonicalHistoricalEntities);
router.get('/entities/:id', getCanonicalHistoricalEntityById);
router.post('/entities', createCanonicalHistoricalEntity);
router.delete('/entities/:id', deleteCanonicalHistoricalEntity);
router.get('/search', searchCanonicalHistoricalEntities);

export default router;
