import React from 'react';

interface CenteredContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const CenteredContainer: React.FC<CenteredContainerProps> = ({ children, style }) => {
  return (
    <div
      style={{
        maxWidth: '700px',
        margin: '40px auto',
        background: 'white',
        padding: '48px 40px 40px 40px',
        borderRadius: '14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'left',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default CenteredContainer; 