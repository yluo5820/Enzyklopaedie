import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333' }}>Welcome to Your Booklist App!</h1>
      <p style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
        This is a simple application to help you keep track of books you want to read,
        books you've read, and even lectures you've attended.
      </p>
      <p style={{ fontSize: '1.1em', lineHeight: '1.6' }}>
        You can categorize your readings and lectures by subject/discipline,
        add notes, and rate the content you've consumed.
      </p>
      <h2 style={{ color: '#555', marginTop: '30px' }}>Get Started:</h2>
      <ul style={{ listStyle: 'disc', marginLeft: '20px' }}>
        <li style={{ marginBottom: '10px' }}>
          Navigate to the <a href="/books" style={{ color: '#007bff', textDecoration: 'none' }}>Books page</a> to start adding and managing your book collection.
        </li>
        <li style={{ marginBottom: '10px' }}>
          Explore the navigation bar at the top to switch between different sections of the app.
        </li>
        <li style={{ marginBottom: '10px' }}>
          Feel free to add more features like lecture tracking, subject management, and detailed notes!
        </li>
      </ul>
      <p style={{ marginTop: '40px', fontSize: '0.9em', color: '#777' }}>
        This application is built with React, TypeScript, Node.js (Express), and SQLite.
      </p>
    </div>
  );
};

export default HomePage;