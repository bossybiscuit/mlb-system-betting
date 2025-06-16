import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  // Always allow access for now
  return children;
}

export default ProtectedRoute; 