import React from 'react';
import { Navigate } from 'react-router-dom';
import { useMemberstack } from '@memberstack/react';

function ProtectedRoute({ children }) {
  const { member } = useMemberstack();
  
  // Development mode bypass
  const isDevelopment = process.env.NODE_ENV === 'development';
  const bypassAuth = true; // Set this to false when you want to re-enable authentication

  // Allow access if we're in development mode and bypass is enabled
  if (isDevelopment && bypassAuth) {
    console.log('ProtectedRoute: Development mode bypass active');
    return children;
  }

  // Normal authentication check
  if (!member) {
    console.log('ProtectedRoute: Authentication required, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute; 