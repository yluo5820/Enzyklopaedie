import express from 'express';
import bookRoutes from './routes/bookRoutes';
import subjectRoutes from './routes/subjectRoutes';
import lectureRoutes from './routes/lectureRoutes';
import noteRoutes from './routes/noteRoutes';
import commentRoutes from './routes/commentRoutes';
import authorRoutes from './routes/authorRoutes';
import nationRoutes from './routes/nationRoutes';
import civilizationRoutes from './routes/civilizationRoutes';
import eraRoutes from './routes/eraRoutes';
import knowledgeItemRoutes from './routes/knowledgeItemRoutes';
import activityEventRoutes from './routes/activityEventRoutes';
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
app.use('/api/authors', authorRoutes);
app.use('/api/nations', nationRoutes);
app.use('/api/civilizations', civilizationRoutes);
app.use('/api/eras', eraRoutes);
app.use('/api/knowledge-items', knowledgeItemRoutes);
app.use('/api/activity-events', activityEventRoutes);

export default app;
