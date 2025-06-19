import express from 'express';
import bookRoutes from './routes/bookRoutes';
// Import other routes (lecture, subject, note, comment)
import cors from 'cors'; // For development, allow cross-origin requests from client

const app = express();

app.use(cors()); // Enable CORS
app.use(express.json()); // Enable JSON body parsing

// API Routes
app.use('/api/books', bookRoutes);
// app.use('/api/lectures', lectureRoutes);
// app.use('/api/subjects', subjectRoutes);
// app.use('/api/notes', noteRoutes);
// app.use('/api/comments', commentRoutes);

export default app;