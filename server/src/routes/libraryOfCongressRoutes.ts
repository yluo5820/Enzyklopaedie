import { Router } from 'express';
import { searchLibraryOfCongressBooks } from '../controllers/libraryOfCongressController';

const router = Router();

router.get('/search', searchLibraryOfCongressBooks);

export default router;
