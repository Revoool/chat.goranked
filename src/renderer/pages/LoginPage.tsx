import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tmpToken, setTmpToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let response: any;
      
      // If 2FA code is provided, verify it
      if (tmpToken && twoFactorCode) {
        response = await apiClient.verify2FA(tmpToken, twoFactorCode);
      } else {
        // Initial login
        response = await apiClient.login(email, password);
        
        // Check if 2FA is required
        if (response.status === '2fa_required' && response.tmp_token) {
          setTmpToken(response.tmp_token);
          setError(''); // Clear any previous errors
          setIsLoading(false);
          return; // Show 2FA input
        }
      }
      
      // API returns accessToken, not token
      const token = response.accessToken || response.token;
      const user = response.userData || response.user;
      
      if (!token) {
        throw new Error('Token not received from server');
      }
      
      console.log('Token received:', token ? 'Yes' : 'No');
      console.log('User data:', user);
      
      // Store token securely
      if (window.electronAPI) {
        try {
          const storeResult = await window.electronAPI.storeToken(token);
          if (!storeResult.success) {
            console.warn('Failed to store token in keychain:', storeResult.error);
            // Fallback to localStorage if keychain fails
            localStorage.setItem('token', token);
          }
        } catch (keychainError) {
          console.warn('Keychain error, using localStorage:', keychainError);
          localStorage.setItem('token', token);
        }
      } else {
        localStorage.setItem('token', token);
      }

      setToken(token);
      setUser(user);
      // Reset 2FA state
      setTmpToken(null);
      setTwoFactorCode('');
      // WebSocket will connect automatically via App useEffect
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Ошибка входа. Проверьте email и пароль.';
      setError(errorMessage);
      
      // Log full error for debugging
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-logo">Goranked</h1>
          <p className="login-slogan">Go forward, get ranked!</p>
          <h2 className="login-title">Chat Desk</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="agent@goranked.gg"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!tmpToken}
              disabled={isLoading || !!tmpToken}
              placeholder="••••••••"
            />
          </div>

          {tmpToken && (
            <div className="form-group">
              <label htmlFor="2fa">Код двухфакторной аутентификации</label>
              <input
                id="2fa"
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Введите код из приложения"
                autoFocus
              />
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Вход...' : tmpToken ? 'Подтвердить' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

