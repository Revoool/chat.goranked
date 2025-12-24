import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import MainDesk from './pages/MainDesk';
import { apiClient } from './api/client';
import { wsClient } from './api/websocket';

const App: React.FC = () => {
  const { user, setUser, setToken, isLoading, setIsLoading, token } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    wsClient.setQueryClient(queryClient);
  }, [queryClient]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get token from keychain
        let token: string | null = null;
        if (window.electronAPI) {
          const result = await window.electronAPI.getToken();
          token = result.success ? result.token : null;
        } else {
          token = localStorage.getItem('token');
        }

        if (token) {
          setToken(token);
          // Verify token and get user info
          try {
            const userData = await apiClient.getMe();
            setUser(userData);
            // Connect WebSocket
            wsClient.connect(token);
          } catch (error: any) {
            // If /api/me fails, try to get user from token or skip
            console.warn('⚠️ Could not verify token with /api/me:', error.response?.status);
            // User data might be stored in token or we can skip verification
            // For now, just set loading to false and let user login again if needed
            console.log('ℹ️ Skipping user verification, user will need to login again');
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setToken(null);
        setUser(null);
        wsClient.disconnect();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [setUser, setToken, setIsLoading]);

  useEffect(() => {
    if (token && user) {
      wsClient.connect(token);
    } else {
      wsClient.disconnect();
    }

    return () => {
      wsClient.disconnect();
    };
  }, [token, user]);

  // Listen for update events from main process
  useEffect(() => {
    if (window.electronAPI) {
      const handleUpdateAvailable = (info: any) => {
        console.log('🔄 Update available notification:', info);
        // The main process already shows a dialog, but we can show additional UI feedback if needed
      };

      // Listen for update-available event from main process
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('update-available', (_event: any, info: any) => {
        handleUpdateAvailable(info);
      });

      return () => {
        if (ipcRenderer) {
          ipcRenderer.removeAllListeners('update-available');
        }
      };
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: 'var(--graphite-dark)'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <MainDesk /> : <Navigate to="/login" />} />
    </Routes>
  );
};

export default App;

