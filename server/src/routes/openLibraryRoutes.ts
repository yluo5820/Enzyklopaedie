import { Router } from 'express';
import { searchOpenLibraryBooks } from '../controllers/openLibraryController';

const router = Router();

router.get('/search', searchOpenLibraryBooks);

export default router;
