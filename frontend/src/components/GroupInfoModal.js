import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import AvatarUpload from './AvatarUpload';
import AddParticipantsModal from './AddParticipantsModal';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function GroupInfoModal({ isOpen, onClose, chat, onChatUpdate }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  
  // Group info state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  
  // Group settings state
  const [settings, setSettings] = useState({
    messagingPermission: 'all',
    editPermission: 'admins',
    addParticipantsPermission: 'admins'
  });

  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (isOpen && chat) {
      setGroupName(chat.name || '');
      setGroupDescription(chat.description || '');
      setGroupAvatar(chat.avatar || '');
      setSettings(chat.settings || {
        messagingPermission: 'all',
        editPermission: 'admins',
        addParticipantsPermission: 'admins'
      });
      setParticipants(chat.participants || []);
      setEditing(false);
    }
  }, [isOpen, chat]);

  const isAdmin = () => {
    const currentUserParticipant = participants.find(p => p.user._id === user?.id);
    return currentUserParticipant?.role === 'admin' || currentUserParticipant?.role === 'owner';
  };

  const isOwner = () => {
    const currentUserParticipant = participants.find(p => p.user._id === user?.id);
    return currentUserParticipant?.role === 'owner';
  };

  const handleSaveGroupInfo = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatar: groupAvatar
      };

      const { data } = await api.put(`/chats/${chat._id}`, updateData);
      
      onChatUpdate(data.chat);
      setEditing(false);
      toast.success('Group info updated successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update group info');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.put(`/chats/${chat._id}`, { settings });
      
      onChatUpdate(data.chat);
      toast.success('Group settings updated successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update group settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const participant = participants.find(p => p.user._id === participantId);
    
    if (!participant) return;
    
    if (participant.role === 'owner') {
      toast.error('Cannot remove group owner');
      return;
    }

    if (!window.confirm(`Remove ${participant.user.name} from the group?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/chats/${chat._id}/participants/${participantId}`);
      
      setParticipants(prev => prev.filter(p => p.user._id !== participantId));
      toast.success('Participant removed successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to remove participant');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (participantId) => {
    setLoading(true);
    try {
      await api.put(`/chats/${chat._id}/participants/${participantId}/role`, { role: 'admin' });
      
      setParticipants(prev => prev.map(p => 
        p.user._id === participantId ? { ...p, role: 'admin' } : p
      ));
      toast.success('Participant promoted to admin');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to promote participant');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteFromAdmin = async (participantId) => {
    setLoading(true);
    try {
      await api.put(`/chats/${chat._id}/participants/${participantId}/role`, { role: 'member' });
      
      setParticipants(prev => prev.map(p => 
        p.user._id === participantId ? { ...p, role: 'member' } : p
      ));
      toast.success('Admin demoted to member');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to demote admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/chats/${chat._id}/participants/${user?.id}`);
      
      onClose();
      toast.success('Left group successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to leave group');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpdate = (avatarUrl, updatedUser) => {
    setGroupAvatar(avatarUrl);
  };

  const handleParticipantsAdded = (newParticipants) => {
    setParticipants(prev => [...prev, ...newParticipants]);
    setShowAddParticipants(false);
  };

  if (!isOpen || !chat) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal group-info-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Group Info</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="group-info-tabs">
            <button 
              className={`tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
            <button 
              className={`tab ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              Participants ({participants.length})
            </button>
            {isAdmin() && (
              <button 
                className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            )}
          </div>

          {activeTab === 'info' && (
            <div className="group-info-content">
              <div className="group-avatar-section">
                {editing && isAdmin() ? (
                  <AvatarUpload
                    currentAvatar={groupAvatar}
                    onAvatarUpdate={handleAvatarUpdate}
                    size="large"
                  />
                ) : (
                  <div className="group-avatar-display">
                    {groupAvatar ? (
                      <img src={groupAvatar} alt={groupName} />
                    ) : (
                      <span>{(groupName || '?').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="group-details">
                {editing ? (
                  <>
                    <div className="form-group">
                      <label>Group Name</label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="form-input"
                        maxLength={100}
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        className="form-textarea"
                        rows={3}
                        maxLength={500}
                        placeholder="Add a group description"
                      />
                    </div>

                    <div className="form-actions">
                      <button 
                        className="btn-secondary"
                        onClick={() => setEditing(false)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn-primary"
                        onClick={handleSaveGroupInfo}
                        disabled={loading || !groupName.trim()}
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="group-name">
                      <h3>{groupName}</h3>
                      {isAdmin() && (
                        <button 
                          className="edit-btn"
                          onClick={() => setEditing(true)}
                        >
                          ✏️
                        </button>
                      )}
                    </div>

                    {groupDescription && (
                      <div className="group-description">
                        <p>{groupDescription}</p>
                      </div>
                    )}

                    <div className="group-meta">
                      <div className="meta-item">
                        <span className="meta-label">Created:</span>
                        <span className="meta-value">
                          {new Date(chat.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Participants:</span>
                        <span className="meta-value">{participants.length}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="participants-content">
              <div className="participants-header">
                <h4>Participants ({participants.length})</h4>
                {isAdmin() && (
                  <button 
                    className="add-participants-btn"
                    onClick={() => setShowAddParticipants(true)}
                  >
                    + Add Participants
                  </button>
                )}
              </div>

              <div className="participants-list">
                {participants.map(participant => (
                  <div key={participant.user._id} className="participant-item">
                    <div className="participant-avatar">
                      {participant.user.avatar ? (
                        <img src={participant.user.avatar} alt={participant.user.name} />
                      ) : (
                        <span>{participant.user.name.slice(0, 1).toUpperCase()}</span>
                      )}
                      {participant.user.isOnline && <div className="online-dot"></div>}
                    </div>

                    <div className="participant-info">
                      <div className="participant-name">
                        {participant.user.name}
                        {participant.user._id === user?.id && ' (You)'}
                      </div>
                      <div className="participant-role">
                        {participant.role === 'owner' ? '👑 Owner' :
                         participant.role === 'admin' ? '⭐ Admin' : 'Member'}
                      </div>
                    </div>

                    {isAdmin() && participant.user._id !== user?.id && (
                      <div className="participant-actions">
                        <button className="action-btn" title="More actions">⋮</button>
                        <div className="action-menu">
                          {participant.role === 'member' && isOwner() && (
                            <button onClick={() => handlePromoteToAdmin(participant.user._id)}>
                              Make Admin
                            </button>
                          )}
                          {participant.role === 'admin' && isOwner() && (
                            <button onClick={() => handleDemoteFromAdmin(participant.user._id)}>
                              Remove Admin
                            </button>
                          )}
                          {participant.role !== 'owner' && (
                            <button 
                              onClick={() => handleRemoveParticipant(participant.user._id)}
                              className="remove-action"
                            >
                              Remove from Group
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="group-actions">
                <button 
                  className="leave-group-btn"
                  onClick={handleLeaveGroup}
                  disabled={loading}
                >
                  Leave Group
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && isAdmin() && (
            <div className="settings-content">
              <h4>Group Settings</h4>

              <div className="setting-item">
                <label>Who can send messages</label>
                <select
                  value={settings.messagingPermission}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    messagingPermission: e.target.value
                  }))}
                  className="form-select"
                >
                  <option value="all">All participants</option>
                  <option value="admins">Only admins</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Who can edit group info</label>
                <select
                  value={settings.editPermission}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    editPermission: e.target.value
                  }))}
                  className="form-select"
                >
                  <option value="admins">Only admins</option>
                  <option value="all">All participants</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Who can add participants</label>
                <select
                  value={settings.addParticipantsPermission}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    addParticipantsPermission: e.target.value
                  }))}
                  className="form-select"
                >
                  <option value="admins">Only admins</option>
                  <option value="all">All participants</option>
                </select>
              </div>

              <div className="settings-actions">
                <button 
                  className="btn-primary"
                  onClick={handleSaveSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Participants Modal */}
      <AddParticipantsModal
        isOpen={showAddParticipants}
        onClose={() => setShowAddParticipants(false)}
        chat={chat}
        onParticipantsAdded={handleParticipantsAdded}
      />
    </div>
  );
}
