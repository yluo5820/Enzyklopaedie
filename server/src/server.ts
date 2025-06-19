import app from './app';
import { initializeDatabase } from './db';

const PORT = process.env.PORT || 3001; // Use a different port than React's default (3000)

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();