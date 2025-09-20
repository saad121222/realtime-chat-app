import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  useEffect(() => {
    if (token) {
      localStorage.setItem('accessToken', token);
      api.setToken(token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('accessToken');
      api.setToken(null);
      setIsAuthenticated(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Auto-refresh token
  useEffect(() => {
    if (token) {
      const refreshInterval = setInterval(async () => {
        try {
          const response = await api.post('/auth/refresh-token');
          if (response.data.accessToken) {
            setToken(response.data.accessToken);
            if (response.data.user) {
              setUser(response.data.user);
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          // If refresh fails, logout user
          logout();
        }
      }, 14 * 60 * 1000); // Refresh every 14 minutes (token expires in 15 minutes)

      return () => clearInterval(refreshInterval);
    }
  }, [token]);

  const loginWithOTP = async (accessToken, userData) => {
    setLoading(true);
    try {
      setToken(accessToken);
      setUser(userData);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async (identifier, password) => {
    setLoading(true);
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      const { data } = await api.post('/auth/login-with-password', { 
        identifier, 
        password,
        deviceInfo 
      });
      
      setToken(data.accessToken);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const registerWithPassword = async (name, email, phoneNumber, password) => {
    setLoading(true);
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      const { data } = await api.post('/auth/register-with-password', { 
        name, 
        email, 
        phoneNumber, 
        password,
        deviceInfo 
      });
      
      setToken(data.accessToken);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phoneNumber) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/send-otp', { phoneNumber });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Failed to send OTP' };
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (phoneNumber, otp, name = '') => {
    setLoading(true);
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      const { data } = await api.post('/auth/verify-otp', { 
        phoneNumber, 
        otp, 
        name,
        deviceInfo 
      });
      
      setToken(data.accessToken);
      setUser(data.user);
      return { ok: true, isNewUser: data.isNewUser };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'OTP verification failed' };
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async (phoneNumber) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/resend-otp', { phoneNumber });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Failed to resend OTP' };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    setLoading(true);
    try {
      const { data } = await api.put('/users/profile', profileData);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Profile update failed' };
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      const { data } = await api.put('/users/preferences', { preferences });
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Preferences update failed' };
    }
  };

  const updateOnlineStatus = async (isOnline, socketId = '') => {
    try {
      const { data } = await api.put('/users/status', { isOnline, socketId });
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      console.error('Status update failed:', e);
      return { ok: false };
    }
  };

  const logout = async () => {
    try { 
      await api.post('/auth/logout'); 
    } catch (_) {}
    
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  };

  const logoutAll = async () => {
    try { 
      await api.post('/auth/logout-all'); 
    } catch (_) {}
    
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, message: 'Failed to refresh user data' };
    }
  };

  const blockUser = async (userId) => {
    try {
      const { data } = await api.post(`/users/block/${userId}`);
      return { ok: true, blockedUsers: data.blockedUsers };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Failed to block user' };
    }
  };

  const unblockUser = async (userId) => {
    try {
      const { data } = await api.delete(`/users/block/${userId}`);
      return { ok: true, blockedUsers: data.blockedUsers };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Failed to unblock user' };
    }
  };

  const getBlockedUsers = async () => {
    try {
      const { data } = await api.get('/users/blocked');
      return { ok: true, blockedUsers: data.blockedUsers };
    } catch (e) {
      return { ok: false, message: e?.response?.data?.message || 'Failed to get blocked users' };
    }
  };

  const value = useMemo(() => ({
    token,
    user,
    loading,
    isAuthenticated,
    loginWithOTP,
    loginWithPassword,
    registerWithPassword,
    sendOTP,
    verifyOTP,
    resendOTP,
    updateProfile,
    updatePreferences,
    updateOnlineStatus,
    logout,
    logoutAll,
    refreshUser,
    blockUser,
    unblockUser,
    getBlockedUsers,
    setUser
  }), [token, user, loading, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
