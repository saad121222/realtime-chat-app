import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import AvatarUpload from './AvatarUpload';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Select participants, 2: Group info
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Group info
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep(1);
    setSelectedUsers([]);
    setSearchQuery('');
    setGroupName('');
    setGroupDescription('');
    setGroupAvatar('');
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phoneNumber.includes(searchQuery)
  );

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleNext = () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    setCreating(true);
    try {
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        participantIds: selectedUsers,
        avatar: groupAvatar
      };

      const { data } = await api.post('/chats/group', groupData);
      
      onGroupCreated(data.chat);
      onClose();
      toast.success('Group created successfully!');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleAvatarUpdate = (avatarUrl) => {
    setGroupAvatar(avatarUrl);
  };

  const getSelectedUserNames = () => {
    return selectedUsers
      .map(userId => users.find(u => u.id === userId)?.name)
      .filter(Boolean)
      .join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal group-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 1 ? 'Add Group Participants' : 'Group Info'}
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {step === 1 ? (
            // Step 1: Select Participants
            <div className="participants-step">
              <div className="step-info">
                <p>Select contacts to add to the group</p>
                {selectedUsers.length > 0 && (
                  <div className="selected-count">
                    {selectedUsers.length} participant{selectedUsers.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Selected Users Preview */}
              {selectedUsers.length > 0 && (
                <div className="selected-users">
                  <h4>Selected Participants:</h4>
                  <div className="selected-users-list">
                    {selectedUsers.map(userId => {
                      const selectedUser = users.find(u => u.id === userId);
                      if (!selectedUser) return null;
                      
                      return (
                        <div key={userId} className="selected-user-chip">
                          <div className="user-avatar-small">
                            {selectedUser.avatar ? (
                              <img src={selectedUser.avatar} alt={selectedUser.name} />
                            ) : (
                              <span>{selectedUser.name.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <span className="user-name">{selectedUser.name}</span>
                          <button 
                            className="remove-user"
                            onClick={() => handleUserToggle(userId)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="loading">Loading contacts...</div>
              ) : (
                <div className="user-list">
                  {filteredUsers.length === 0 ? (
                    <div className="empty-state">No contacts found</div>
                  ) : (
                    filteredUsers.map(contact => (
                      <div 
                        key={contact.id} 
                        className={`user-item ${selectedUsers.includes(contact.id) ? 'selected' : ''}`}
                        onClick={() => handleUserToggle(contact.id)}
                      >
                        <div className="user-avatar">
                          {contact.avatar ? (
                            <img src={contact.avatar} alt={contact.name} />
                          ) : (
                            <span>{contact.name.slice(0, 2).toUpperCase()}</span>
                          )}
                          {contact.isOnline && <div className="online-dot"></div>}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{contact.name}</div>
                          <div className="user-phone">{contact.phoneNumber}</div>
                        </div>
                        <div className="selection-indicator">
                          {selectedUsers.includes(contact.id) && <span>✓</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="step-actions">
                <button 
                  className="btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleNext}
                  disabled={selectedUsers.length === 0}
                >
                  Next ({selectedUsers.length})
                </button>
              </div>
            </div>
          ) : (
            // Step 2: Group Info
            <div className="group-info-step">
              <div className="group-avatar-section">
                <AvatarUpload
                  currentAvatar={groupAvatar}
                  onAvatarUpdate={handleAvatarUpdate}
                  size="large"
                />
              </div>

              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="form-input"
                  maxLength={100}
                  required
                />
                <small className="char-count">{groupName.length}/100</small>
              </div>

              <div className="form-group">
                <label>Group Description</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Add a group description (optional)"
                  className="form-textarea"
                  rows={3}
                  maxLength={500}
                />
                <small className="char-count">{groupDescription.length}/500</small>
              </div>

              <div className="participants-summary">
                <h4>Participants ({selectedUsers.length + 1})</h4>
                <div className="participants-list">
                  {/* Current user (admin) */}
                  <div className="participant-item admin">
                    <div className="user-avatar-small">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <span>{(user?.name || '').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="participant-info">
                      <span className="participant-name">{user?.name} (You)</span>
                      <span className="participant-role">Admin</span>
                    </div>
                  </div>

                  {/* Selected participants */}
                  {selectedUsers.map(userId => {
                    const participant = users.find(u => u.id === userId);
                    if (!participant) return null;
                    
                    return (
                      <div key={userId} className="participant-item">
                        <div className="user-avatar-small">
                          {participant.avatar ? (
                            <img src={participant.avatar} alt={participant.name} />
                          ) : (
                            <span>{participant.name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="participant-info">
                          <span className="participant-name">{participant.name}</span>
                          <span className="participant-role">Member</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="step-actions">
                <button 
                  className="btn-secondary"
                  onClick={handleBack}
                  disabled={creating}
                >
                  Back
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleCreateGroup}
                  disabled={creating || !groupName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
