import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AddParticipantsModal({ isOpen, onClose, chat, onParticipantsAdded }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSelectedUsers([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      
      // Filter out users who are already in the group
      const existingParticipantIds = chat.participants?.map(p => p.user._id) || [];
      const availableUsers = (data.users || []).filter(
        user => !existingParticipantIds.includes(user.id)
      );
      
      setUsers(availableUsers);
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

  const handleAddParticipants = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    setAdding(true);
    try {
      const { data } = await api.post(`/chats/${chat._id}/participants`, {
        participantIds: selectedUsers
      });

      // Get the newly added participants data
      const newParticipants = selectedUsers.map(userId => {
        const userData = users.find(u => u.id === userId);
        return {
          user: {
            _id: userId,
            name: userData.name,
            avatar: userData.avatar,
            phoneNumber: userData.phoneNumber,
            isOnline: userData.isOnline
          },
          role: 'member',
          joinedAt: new Date(),
          isActive: true
        };
      });

      onParticipantsAdded(newParticipants);
      onClose();
      toast.success(`${selectedUsers.length} participant${selectedUsers.length !== 1 ? 's' : ''} added successfully`);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to add participants');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-participants-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Participants</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="selected-participants">
              <h4>Selected ({selectedUsers.length})</h4>
              <div className="selected-list">
                {selectedUsers.map(userId => {
                  const selectedUser = users.find(u => u.id === userId);
                  if (!selectedUser) return null;
                  
                  return (
                    <div key={userId} className="selected-participant-chip">
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
            <div className="available-users">
              <h4>Available Contacts</h4>
              <div className="user-list">
                {filteredUsers.length === 0 ? (
                  <div className="empty-state">
                    {searchQuery ? 'No contacts found' : 'No available contacts to add'}
                  </div>
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
            </div>
          )}

          <div className="modal-actions">
            <button 
              className="btn-secondary"
              onClick={onClose}
              disabled={adding}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleAddParticipants}
              disabled={adding || selectedUsers.length === 0}
            >
              {adding ? 'Adding...' : `Add ${selectedUsers.length} Participant${selectedUsers.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
