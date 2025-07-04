import { Router } from 'express';
import {
  getAllLectures,
  getLectureById,
  createLecture,
  updateLecture,
  deleteLecture,
} from '../controllers/lectureController';

const router = Router();

router.get('/', getAllLectures);
router.get('/:id', getLectureById);
router.post('/', createLecture);
router.put('/:id', updateLecture);
router.delete('/:id', deleteLecture);

export default router; 