import React, { useState, useEffect } from 'react';
import CreateGroupModal from './CreateGroupModal';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function NewChatModal({ isOpen, onClose, onChatCreated }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createChat = async (userId) => {
    setCreating(true);
    try {
      const { data } = await api.post('/chats', { participantId: userId });
      onChatCreated(data.chat);
      onClose();
      toast.success('Chat created successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Chat</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* Chat Type Options */}
          <div className="chat-type-options">
            <button 
              className="chat-type-btn group-btn"
              onClick={() => setShowCreateGroup(true)}
            >
              <span className="chat-type-icon">👥</span>
              <div className="chat-type-info">
                <div className="chat-type-title">New Group</div>
                <div className="chat-type-desc">Create a group chat</div>
              </div>
            </button>
          </div>

          <div className="divider">
            <span>or start a direct chat</span>
          </div>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <div className="user-list">
              {filteredUsers.length === 0 ? (
                <div className="empty-state">No users found</div>
              ) : (
                filteredUsers.map(user => (
                  <div key={user.id} className="user-item" onClick={() => createChat(user.id)}>
                    <div className="user-avatar">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <span>{user.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      {user.isOnline && <div className="online-dot"></div>}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-email">{user.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={(group) => {
          setShowCreateGroup(false);
          onChatCreated(group);
        }}
      />
    </div>
  );
}
