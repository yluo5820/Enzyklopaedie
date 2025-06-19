# Enzyklopaedie
Build your own encyclopedia with your reading experience, create your own system of knowledge.

.
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api/                  // API service functions (e.g., fetchBooks, addBook)
│   │   │   └── index.ts
│   │   ├── assets/
│   │   ├── components/           // Reusable UI components
│   │   │   ├── BookCard.tsx
│   │   │   ├── LectureCard.tsx
│   │   │   └── common/
│   │   │       └── Button.tsx
│   │   ├── hooks/                // Custom React hooks (e.g., useBooks, useLectures)
│   │   ├── pages/                // Top-level page components
│   │   │   ├── HomePage.tsx
│   │   │   ├── BookListPage.tsx
│   │   │   ├── LectureListPage.tsx
│   │   │   ├── BookDetailPage.tsx
│   │   │   └── SubjectPage.tsx
│   │   ├── types/                // TypeScript interfaces and types for frontend
│   │   │   ├── index.ts          // Exports all types
│   │   │   ├── Book.d.ts         // Interface for Book
│   │   │   ├── Lecture.d.ts      // Interface for Lecture
│   │   │   ├── Note.d.ts
│   │   │   └── Subject.d.ts
│   │   ├── App.tsx               // Main application component, sets up routing
│   │   ├── main.tsx              // Entry point for React application
│   │   └── index.css             // Global styles
│   ├── tailwind.config.js        // Tailwind CSS configuration (if used)
│   ├── tsconfig.json             // TypeScript configuration for client
│   ├── vite.config.ts            // Vite configuration
│   └── package.json              // Frontend dependencies
│
├── server/
│   ├── src/
│   │   ├── config/               // Configuration files (e.g., database path)
│   │   │   └── index.ts
│   │   ├── controllers/          // Request handlers (logic for each route)
│   │   │   ├── bookController.ts
│   │   │   ├── lectureController.ts
│   │   │   └── subjectController.ts
│   │   ├── db/                   // Database initialization and helper functions
│   │   │   ├── index.ts          // DB connection, initialization, migrations
│   │   │   └── queries.ts        // SQL queries or data access functions
│   │   ├── routes/               // API routes definitions
│   │   │   ├── bookRoutes.ts
│   │   │   ├── lectureRoutes.ts
│   │   │   └── subjectRoutes.ts
│   │   ├── types/                // TypeScript interfaces and types for backend
│   │   │   ├── index.ts          // Exports all types (should mirror frontend types where applicable)
│   │   │   ├── Book.d.ts
│   │   │   ├── Lecture.d.ts
│   │   │   ├── Note.d.ts
│   │   │   └── Subject.d.ts
│   │   ├── utils/                // Utility functions
│   │   │   └── helpers.ts
│   │   └── app.ts                // Express application setup
│   │   └── server.ts             // Main entry point for the backend server
│   ├── data.db                   // SQLite database file (will be created)
│   ├── tsconfig.json             // TypeScript configuration for server
│   ├── package.json              // Backend dependencies
│   └── .env                      // Environment variables (e.g., DB_PATH)
│
├── .gitignore
├── README.md
└── package.json (Optional: for monorepo setup with workspaces, but not strictly necessary here)