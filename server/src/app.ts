import express from 'express';
import bookRoutes from './routes/bookRoutes';
import subjectRoutes from './routes/subjectRoutes';
import lectureRoutes from './routes/lectureRoutes';
import noteRoutes from './routes/noteRoutes';
import commentRoutes from './routes/commentRoutes';
import cors from 'cors'; // For development, allow cross-origin requests from client

const app = express();

app.use(cors()); // Enable CORS
app.use(express.json()); // Enable JSON body parsing

// API Routes
app.use('/api/books', bookRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/comments', commentRoutes);

export default app;