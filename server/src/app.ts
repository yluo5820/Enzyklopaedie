import express from 'express';
import knowledgeItemRoutes from './routes/knowledgeItemRoutes';
import activityEventRoutes from './routes/activityEventRoutes';
import knowledgeNoteRoutes from './routes/knowledgeNoteRoutes';
import knowledgeItemTopicRoutes from './routes/knowledgeItemTopicRoutes';
import knowledgeRelationRoutes from './routes/knowledgeRelationRoutes';
import knowledgeTaskRoutes from './routes/knowledgeTaskRoutes';
import knowledgeReviewRoutes from './routes/knowledgeReviewRoutes';
import topicRoutes from './routes/topicRoutes';
import subjectRoutes from './routes/subjectRoutes';
import referenceEntityRoutes from './routes/referenceEntityRoutes';
import openLibraryRoutes from './routes/openLibraryRoutes';
import libraryOfCongressRoutes from './routes/libraryOfCongressRoutes';
import worldHistoryRoutes from './routes/worldHistoryRoutes';
import cors from 'cors'; // For development, allow cross-origin requests from client

const app = express();

app.use(cors()); // Enable CORS
app.use(express.json()); // Enable JSON body parsing

// API Routes
app.use('/api/subjects', subjectRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/reference-entities', referenceEntityRoutes);
app.use('/api/open-library', openLibraryRoutes);
app.use('/api/library-of-congress', libraryOfCongressRoutes);
app.use('/api/world-history', worldHistoryRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/notes', knowledgeNoteRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/topics', knowledgeItemTopicRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/relations', knowledgeRelationRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/tasks', knowledgeTaskRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/reviews', knowledgeReviewRoutes);
app.use('/api/knowledge-items', knowledgeItemRoutes);
app.use('/api/activity-events', activityEventRoutes);

export default app;
