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
import knowledgeNoteRoutes from './routes/knowledgeNoteRoutes';
import knowledgeItemTopicRoutes from './routes/knowledgeItemTopicRoutes';
import knowledgeItemStudyTopicRoutes from './routes/knowledgeItemStudyTopicRoutes';
import knowledgeRelationRoutes from './routes/knowledgeRelationRoutes';
import knowledgeTaskRoutes from './routes/knowledgeTaskRoutes';
import knowledgeReviewRoutes from './routes/knowledgeReviewRoutes';
import topicRoutes from './routes/topicRoutes';
import studyTopicRoutes from './routes/studyTopicRoutes';
import referenceEntityRoutes from './routes/referenceEntityRoutes';
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
app.use('/api/topics', topicRoutes);
app.use('/api/study-topics', studyTopicRoutes);
app.use('/api/reference-entities', referenceEntityRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/notes', knowledgeNoteRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/topics', knowledgeItemTopicRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/study-topics', knowledgeItemStudyTopicRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/relations', knowledgeRelationRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/tasks', knowledgeTaskRoutes);
app.use('/api/knowledge-items/:knowledgeItemId/reviews', knowledgeReviewRoutes);
app.use('/api/knowledge-items', knowledgeItemRoutes);
app.use('/api/activity-events', activityEventRoutes);

export default app;
