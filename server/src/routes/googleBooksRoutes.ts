import { Router } from 'express';
import { searchGoogleBooks } from '../controllers/googleBooksController';

const router = Router();

router.get('/search', searchGoogleBooks);

export default router;
