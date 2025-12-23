import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { ToastProvider } from './components/Toast';
import Chat from './pages/Chat';
import Login from './pages/Login';
import { User } from './types';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('an_im_user');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    navigate('/chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('an_im_user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    navigate('/login');
  };

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            !currentUser ?
              <Login onLoginSuccess={handleLoginSuccess} /> :
              <Navigate to="/chat" replace />
          }
        />
        <Route
          path="/chat"
          element={
            currentUser ?
              <Chat
                currentUser={currentUser}
                handleLogout={handleLogout}
              /> :
              <Navigate to="/login" replace />
          }
        />
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;