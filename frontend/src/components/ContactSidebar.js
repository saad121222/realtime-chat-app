import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { UnreadBadge, MutedBadge } from './NotificationBadge';
import notificationService from '../services/notificationService';

export default function ContactSidebar({
  chats = [],
  activeChat,
  onChatSelect,
  onNewChat,
  onProfileClick,
  onLogout,
  onNotificationSettings,
  onSettings,
  loading,
  onlineUsers = new Set(),
  unreadCounts = new Map(),
  user
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [filteredChats, setFilteredChats] = useState([]);
  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter(chat => 
        chat.name?.toLowerCase().includes(query) ||
        chat.lastMessage?.content?.toLowerCase().includes(query)
      );
      setFilteredChats(filtered);
    }
  }, [chats, searchQuery]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  // Format last message time
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM dd');
    }
  };

  // Format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Last seen recently';
    
    const date = new Date(lastSeen);
    
    if (isToday(date)) {
      return `Last seen today at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Last seen yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
    }
  };

  // Get last message preview
  const getLastMessagePreview = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    
    const message = chat.lastMessage;
    const isOwn = message.sender?._id === user?.id;
    const prefix = isOwn ? 'You: ' : '';
    
    switch (message.messageType) {
      case 'image':
        return `${prefix}📷 Photo`;
      case 'video':
        return `${prefix}🎥 Video`;
      case 'audio':
        return `${prefix}🎵 Audio`;
      case 'document':
        return `${prefix}📄 Document`;
      default:
        return `${prefix}${message.content || 'Message'}`;
    }
  };

  // Check if user is online
  const isUserOnline = (chat) => {
    if (chat.chatType === 'group') {
      return chat.participants?.some(p => 
        p.user._id !== user?.id && onlineUsers.has(p.user._id)
      );
    } else {
      const otherParticipant = chat.participants?.find(
        p => p.user._id !== user?.id
      );
      return otherParticipant ? onlineUsers.has(otherParticipant.user._id) : false;
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Escape to clear search
      if (event.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  return (
    <div className="contact-sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="user-info" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className="user-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <span>{(user?.name || '?').slice(0, 2).toUpperCase()}</span>
            )}
            <div className="online-indicator"></div>
          </div>
          <div className="user-details">
            <div className="user-name">{user?.name}</div>
            <div className="user-status">Online</div>
          </div>
          <div className="dropdown-arrow">▼</div>
        </div>

        {/* User Menu */}
        {showUserMenu && (
          <div className="user-menu" ref={userMenuRef}>
            <button onClick={onProfileClick}>
              <span className="menu-icon">👤</span>
              Profile
            </button>
            <button onClick={onNotificationSettings}>
              <span className="menu-icon">🔔</span>
              Notifications
            </button>
            <button onClick={onSettings}>
              <span className="menu-icon">⚙️</span>
              Settings
            </button>
            <div className="menu-divider"></div>
            <button onClick={onLogout} className="logout-btn">
              <span className="menu-icon">🚪</span>
              Logout
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="header-actions">
          <button 
            className="action-btn"
            onClick={onNewChat}
            title="New Chat"
          >
            💬
          </button>
          <button 
            className="action-btn"
            title="Menu"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="clear-search"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="chat-list">
        {loading ? (
          <div className="loading-chats">
            <div className="loading-spinner"></div>
            <span>Loading chats...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="empty-chats">
            {searchQuery ? (
              <div className="no-results">
                <span className="no-results-icon">🔍</span>
                <p>No chats found for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="no-chats">
                <span className="no-chats-icon">💬</span>
                <p>No chats yet</p>
                <button onClick={onNewChat} className="start-chat-btn">
                  Start New Chat
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChat?._id === chat._id;
            const unreadCount = unreadCounts.get(chat._id) || 0;
            const isOnline = isUserOnline(chat);
            const chatSettings = notificationService.getChatSettings(chat._id);
            const isMuted = !chatSettings.enabled;
            
            return (
              <div
                key={chat._id}
                className={`chat-item ${isActive ? 'active' : ''} ${isMuted ? 'muted' : ''}`}
                onClick={() => onChatSelect(chat)}
              >
                <div className="chat-avatar">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} />
                  ) : (
                    <span>{(chat.name || '?').slice(0, 2).toUpperCase()}</span>
                  )}
                  {isOnline && <div className="online-dot"></div>}
                </div>

                <div className="chat-content">
                  <div className="chat-header">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-time">
                      {formatMessageTime(chat.lastActivity || chat.updatedAt)}
                    </div>
                  </div>

                  <div className="chat-preview">
                    <div className="last-message">
                      {getLastMessagePreview(chat)}
                    </div>
                    <div className="chat-meta">
                      <div className="notification-indicators">
                        <MutedBadge isMuted={isMuted} />
                        <UnreadBadge count={unreadCount} />
                      </div>
                      {chat.lastMessage?.status && chat.lastMessage.sender?._id === user?.id && (
                        <div className={`message-status ${chat.lastMessage.status}`}>
                          {chat.lastMessage.status === 'read' ? '✓✓' : 
                           chat.lastMessage.status === 'delivered' ? '✓✓' : '✓'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Online Status for Direct Chats */}
                  {chat.chatType === 'direct' && (
                    <div className="online-status">
                      {isOnline ? (
                        <span className="status-online">Online</span>
                      ) : (
                        <span className="status-offline">
                          {formatLastSeen(chat.lastSeen)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="connection-status">
          <div className="status-indicator connected"></div>
          <span>Connected</span>
        </div>
      </div>
    </div>
  );
}
