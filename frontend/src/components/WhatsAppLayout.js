import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import ContactSidebar from './ContactSidebar';
import ChatWindowResponsive from './ChatWindowResponsive';
import ProfileModalEnhanced from './ProfileModalEnhanced';
import NewChatModal from './NewChatModal';
import NotificationSettings from './NotificationSettings';
import SettingsPanel from './SettingsPanel';
import socketService from '../services/socketEnhanced';
import notificationService from '../services/notificationService';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function WhatsAppLayout() {
  const { user, logout, updateOnlineStatus } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState(new Map());
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // On desktop, always show sidebar
      if (!mobile) {
        setShowSidebar(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize socket connection and load chats
  useEffect(() => {
    if (user?.id) {
      // Connect to socket
      const token = localStorage.getItem('accessToken');
      if (token) {
        socketService.connect(token);
      }

      // Load initial chats
      loadChats();

      // Update online status
      updateOnlineStatus(true);
    }

    return () => {
      // Cleanup on unmount
      if (user?.id) {
        updateOnlineStatus(false);
        socketService.disconnect();
      }
    };
  }, [user?.id]);

  // Socket event handlers
  useEffect(() => {
    const handleSocketConnected = () => {
      console.log('Socket connected successfully');
      if (user?.id) {
        updateOnlineStatus(true);
      }
    };

    const handleSocketDisconnected = () => {
      console.log('Socket disconnected');
    };

    const handleNewMessage = (data) => {
      // Update chat list with new message
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (chat._id === data.chatId) {
            return {
              ...chat,
              lastMessage: data.message,
              lastActivity: new Date().toISOString()
            };
          }
          return chat;
        });

        // Sort by last activity
        return updatedChats.sort((a, b) => 
          new Date(b.lastActivity) - new Date(a.lastActivity)
        );
      });

      // Update unread count if not active chat
      if (data.chatId !== activeChat?._id && data.message.sender._id !== user?.id) {
        setUnreadCounts(prev => {
          const newCounts = new Map(prev);
          const currentCount = newCounts.get(data.chatId) || 0;
          newCounts.set(data.chatId, currentCount + 1);
          return newCounts;
        });

        // Show notification using notification service
        const chat = chats.find(c => c._id === data.chatId);
        if (chat) {
          notificationService.notifyNewMessage(
            data.message,
            chat,
            data.message.sender
          );
        }
      }
    };

    const handleChatCreated = (data) => {
      setChats(prevChats => [data.chat, ...prevChats]);
    };

    const handleUserOnline = (data) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
      
      // Update chat list to reflect online status
      setChats(prevChats => 
        prevChats.map(chat => {
          if (chat.chatType === 'direct') {
            const otherParticipant = chat.participants?.find(
              p => p.user._id !== user?.id
            );
            if (otherParticipant?.user._id === data.userId) {
              return { ...chat, isOnline: true };
            }
          }
          return chat;
        })
      );
    };

    const handleUserOffline = (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });

      // Update chat list to reflect offline status
      setChats(prevChats => 
        prevChats.map(chat => {
          if (chat.chatType === 'direct') {
            const otherParticipant = chat.participants?.find(
              p => p.user._id !== user?.id
            );
            if (otherParticipant?.user._id === data.userId) {
              return { 
                ...chat, 
                isOnline: false, 
                lastSeen: data.lastSeen 
              };
            }
          }
          return chat;
        })
      );
    };

    // Register socket event listeners
    socketService.on('socket_connected', handleSocketConnected);
    socketService.on('socket_disconnected', handleSocketDisconnected);
    socketService.on('new_message', handleNewMessage);
    socketService.on('chat_created', handleChatCreated);
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);

    return () => {
      // Cleanup event listeners
      socketService.off('socket_connected', handleSocketConnected);
      socketService.off('socket_disconnected', handleSocketDisconnected);
      socketService.off('new_message', handleNewMessage);
      socketService.off('chat_created', handleChatCreated);
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
    };
  }, [user?.id, activeChat?._id, chats]);

  // Update total unread count and badge
  useEffect(() => {
    const total = Array.from(unreadCounts.values()).reduce((sum, count) => sum + count, 0);
    setTotalUnreadCount(total);
    notificationService.updateBadge(total);
  }, [unreadCounts]);

  // Load chats from API
  const loadChats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/chats');
      const chatsData = response.data.chats || [];
      
      // Process chats to add computed properties
      const processedChats = chatsData.map(chat => {
        if (chat.chatType === 'direct' && chat.participantUsers) {
          const otherParticipant = chat.participantUsers.find(
            user => user._id !== user?.id
          );
          
          if (otherParticipant) {
            return {
              ...chat,
              name: otherParticipant.name,
              avatar: otherParticipant.avatar,
              isOnline: otherParticipant.isOnline,
              lastSeen: otherParticipant.lastSeen
            };
          }
        }
        return chat;
      });

      setChats(processedChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  // Handle chat selection
  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    
    // Clear unread count for selected chat
    setUnreadCounts(prev => {
      const newCounts = new Map(prev);
      newCounts.delete(chat._id);
      return newCounts;
    });

    // On mobile, hide sidebar when chat is selected
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  // Handle back to chat list (mobile)
  const handleBackToChats = () => {
    if (isMobile) {
      setActiveChat(null);
      setShowSidebar(true);
    }
  };

  // Handle new chat creation
  const handleNewChat = (newChat) => {
    setChats(prevChats => [newChat, ...prevChats]);
    setActiveChat(newChat);
    setShowNewChatModal(false);
    
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await updateOnlineStatus(false);
      socketService.disconnect();
      logout();
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="whatsapp-layout">
      {/* Sidebar */}
      <div className={`sidebar ${showSidebar ? 'show' : 'hide'} ${isMobile ? 'mobile' : 'desktop'}`}>
        <ContactSidebar
          chats={chats}
          activeChat={activeChat}
          onChatSelect={handleChatSelect}
          onNewChat={() => setShowNewChatModal(true)}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={handleLogout}
          onNotificationSettings={() => setShowNotificationSettings(true)}
          onSettings={() => setShowSettingsPanel(true)}
          loading={loading}
          onlineUsers={onlineUsers}
          unreadCounts={unreadCounts}
          user={user}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`main-chat ${!showSidebar || isMobile ? 'full-width' : ''}`}>
        {activeChat ? (
          <ChatWindowResponsive
            chat={activeChat}
            onBack={handleBackToChats}
            onChatUpdate={(updatedChat) => {
              setChats(prevChats => 
                prevChats.map(chat => 
                  chat._id === updatedChat._id ? updatedChat : chat
                )
              );
            }}
            showBackButton={isMobile}
          />
        ) : (
          <div className="welcome-area">
            <div className="welcome-content">
              <div className="welcome-logo">💬</div>
              <h2>WhatsApp Clone</h2>
              <p>Send and receive messages without keeping your phone online.</p>
              <div className="welcome-features">
                <div className="feature-item">
                  <span className="feature-icon">🔒</span>
                  <span>End-to-end encrypted</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">⚡</span>
                  <span>Real-time messaging</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📱</span>
                  <span>Works on all devices</span>
                </div>
              </div>
              {isMobile && (
                <button 
                  className="mobile-new-chat-btn"
                  onClick={() => setShowNewChatModal(true)}
                >
                  Start New Chat
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Toggle Button */}
      {isMobile && activeChat && (
        <button 
          className="mobile-sidebar-toggle"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          ☰
        </button>
      )}

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleNewChat}
      />

      <ProfileModalEnhanced
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <NotificationSettings
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />

      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
      />

      {/* Mobile Overlay */}
      {isMobile && showSidebar && activeChat && (
        <div 
          className="mobile-overlay"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
}
