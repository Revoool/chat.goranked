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
    if (!window.electronAPI) return;

    const cleanupFunctions: (() => void)[] = [];

    // Listen for update-available event
    if (window.electronAPI.onUpdateAvailable) {
      const cleanup = window.electronAPI.onUpdateAvailable((info: any) => {
        console.log('🔄 Update available notification:', info);
        // Store update info for Settings component
        localStorage.setItem('update.available', JSON.stringify(info));
        // Trigger custom event for Settings component
        window.dispatchEvent(new CustomEvent('update-available', { detail: info }));
      });
      if (cleanup) cleanupFunctions.push(cleanup);
    }

    // Listen for update-downloaded event
    if (window.electronAPI.onUpdateDownloadProgress) {
      const cleanup = window.electronAPI.onUpdateDownloadProgress((progress: any) => {
        console.log('📥 Update download progress:', progress);
        // Store progress for Settings component
        localStorage.setItem('update.progress', JSON.stringify(progress));
        // Trigger custom event for Settings component
        window.dispatchEvent(new CustomEvent('update-download-progress', { detail: progress }));
      });
      if (cleanup) cleanupFunctions.push(cleanup);
    }

    // Listen for update-downloaded event
    if (window.electronAPI.onUpdateDownloaded) {
      const cleanup = window.electronAPI.onUpdateDownloaded((info: any) => {
        console.log('✅ Update downloaded:', info);
        localStorage.setItem('update.downloaded', JSON.stringify(info));
        window.dispatchEvent(new CustomEvent('update-downloaded', { detail: info }));
      });
      if (cleanup) cleanupFunctions.push(cleanup);
    }

    // Listen for update-not-available event
    if (window.electronAPI.onUpdateNotAvailable) {
      const cleanup = window.electronAPI.onUpdateNotAvailable((info: any) => {
        console.log('✅ No updates available:', info);
        localStorage.removeItem('update.available');
        localStorage.removeItem('update.progress');
        window.dispatchEvent(new CustomEvent('update-not-available', { detail: info }));
      });
      if (cleanup) cleanupFunctions.push(cleanup);
    }

    // Listen for update errors
    if (window.electronAPI.onUpdateError) {
      const cleanup = window.electronAPI.onUpdateError((error: any) => {
        console.error('❌ Update error:', error);
        localStorage.removeItem('update.available');
        localStorage.removeItem('update.progress');
        window.dispatchEvent(new CustomEvent('update-error', { detail: error }));
      });
      if (cleanup) cleanupFunctions.push(cleanup);
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
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
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route path="/" element={user ? <MainDesk /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;

