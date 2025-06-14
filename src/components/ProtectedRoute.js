import React from 'react';
import { Navigate } from 'react-router-dom';
import { useMemberstack } from '@memberstack/react';

function ProtectedRoute({ children }) {
  const { member } = useMemberstack();

  if (!member) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute; 