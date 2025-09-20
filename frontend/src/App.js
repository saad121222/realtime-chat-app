import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import PhoneAuth from './pages/PhoneAuth';
import Chats from './pages/Chats';
import { AuthProvider, useAuth } from './context/AuthContextEnhanced';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/phone-auth" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/phone-auth" element={<PhoneAuth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Chats />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/phone-auth" replace />} />
      </Routes>
    </AuthProvider>
  );
}
