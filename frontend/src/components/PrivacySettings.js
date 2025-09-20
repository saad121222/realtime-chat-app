import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import toast from 'react-hot-toast';

export default function PrivacySettings({ onUnsavedChanges }) {
  const { user, updatePreferences } = useAuth();
  const [settings, setSettings] = useState({
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    status: 'everyone',
    readReceipts: true,
    onlineStatus: true,
    typing: true,
    groupInvites: 'everyone',
    blockedUsers: [],
    twoFactorAuth: false,
    sessionTimeout: 30,
    dataDownload: false,
    accountDeletion: false
  });
  const [originalSettings, setOriginalSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
    { value: 'nobody', label: 'Nobody' }
  ];

  const sessionTimeoutOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours' },
    { value: 1440, label: '24 hours' },
    { value: -1, label: 'Never' }
  ];

  useEffect(() => {
    if (user?.preferences) {
      const userSettings = {
        lastSeen: user.preferences.lastSeen || 'everyone',
        profilePhoto: user.preferences.profilePhoto || 'everyone',
        status: user.preferences.status || 'everyone',
        readReceipts: user.preferences.readReceipts !== false,
        onlineStatus: user.preferences.onlineStatus !== false,
        typing: user.preferences.typing !== false,
        groupInvites: user.preferences.groupInvites || 'everyone',
        blockedUsers: user.preferences.blockedUsers || [],
        twoFactorAuth: user.preferences.twoFactorAuth || false,
        sessionTimeout: user.preferences.sessionTimeout || 30,
        dataDownload: user.preferences.dataDownload || false,
        accountDeletion: user.preferences.accountDeletion || false
      };
      setSettings(userSettings);
      setOriginalSettings(userSettings);
    }
  }, [user]);

  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    onUnsavedChanges?.(hasChanges);
  }, [settings, originalSettings, onUnsavedChanges]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences(settings);
      setOriginalSettings(settings);
      toast.success('Privacy settings updated successfully');
    } catch (error) {
      toast.error('Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all privacy settings?')) {
      setSettings(originalSettings);
    }
  };

  const handleUnblockUser = (userId) => {
    if (window.confirm('Are you sure you want to unblock this user?')) {
      const updatedBlocked = settings.blockedUsers.filter(id => id !== userId);
      handleSettingChange('blockedUsers', updatedBlocked);
      toast.success('User unblocked successfully');
    }
  };

  const handleRequestDataDownload = async () => {
    if (window.confirm('Request a download of all your data? This may take some time to prepare.')) {
      try {
        // API call to request data download
        toast.success('Data download request submitted. You will receive an email when ready.');
        handleSettingChange('dataDownload', true);
      } catch (error) {
        toast.error('Failed to request data download');
      }
    }
  };

  const handleAccountDeletion = async () => {
    const confirmation = window.prompt(
      'Type "DELETE MY ACCOUNT" to confirm account deletion. This action cannot be undone.'
    );
    
    if (confirmation === 'DELETE MY ACCOUNT') {
      try {
        // API call to delete account
        toast.success('Account deletion request submitted. Your account will be deleted in 7 days.');
        handleSettingChange('accountDeletion', true);
      } catch (error) {
        toast.error('Failed to process account deletion request');
      }
    } else if (confirmation !== null) {
      toast.error('Account deletion cancelled - confirmation text did not match');
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="privacy-settings">
      {/* Who Can See My Information */}
      <div className="settings-section">
        <h3>Who can see my personal info</h3>
        
        <div className="privacy-setting">
          <label>Last seen and online</label>
          <select
            value={settings.lastSeen}
            onChange={(e) => handleSettingChange('lastSeen', e.target.value)}
            className="privacy-select"
          >
            {privacyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="setting-description">
            Control who can see when you were last online
          </small>
        </div>

        <div className="privacy-setting">
          <label>Profile photo</label>
          <select
            value={settings.profilePhoto}
            onChange={(e) => handleSettingChange('profilePhoto', e.target.value)}
            className="privacy-select"
          >
            {privacyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="setting-description">
            Control who can see your profile photo
          </small>
        </div>

        <div className="privacy-setting">
          <label>Status</label>
          <select
            value={settings.status}
            onChange={(e) => handleSettingChange('status', e.target.value)}
            className="privacy-select"
          >
            {privacyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="setting-description">
            Control who can see your status message
          </small>
        </div>

        <div className="privacy-setting">
          <label>Group invites</label>
          <select
            value={settings.groupInvites}
            onChange={(e) => handleSettingChange('groupInvites', e.target.value)}
            className="privacy-select"
          >
            {privacyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="setting-description">
            Control who can add you to groups
          </small>
        </div>
      </div>

      {/* Message Privacy */}
      <div className="settings-section">
        <h3>Message privacy</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.readReceipts}
              onChange={(e) => handleSettingChange('readReceipts', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Read receipts</span>
          </label>
          <small className="setting-description">
            Show blue checkmarks when you read messages. Turning this off also disables read receipts for others.
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.onlineStatus}
              onChange={(e) => handleSettingChange('onlineStatus', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Online status</span>
          </label>
          <small className="setting-description">
            Show when you're online to your contacts
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.typing}
              onChange={(e) => handleSettingChange('typing', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Typing indicators</span>
          </label>
          <small className="setting-description">
            Show when you're typing to others
          </small>
        </div>
      </div>

      {/* Blocked Users */}
      <div className="settings-section">
        <h3>Blocked contacts</h3>
        
        <div className="blocked-users-header">
          <span>{settings.blockedUsers.length} blocked contact{settings.blockedUsers.length !== 1 ? 's' : ''}</span>
          <button 
            className="btn-secondary"
            onClick={() => setShowBlockedUsers(!showBlockedUsers)}
          >
            {showBlockedUsers ? 'Hide' : 'Show'} Blocked
          </button>
        </div>

        {showBlockedUsers && (
          <div className="blocked-users-list">
            {settings.blockedUsers.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🚫</span>
                <p>No blocked contacts</p>
              </div>
            ) : (
              settings.blockedUsers.map(userId => (
                <div key={userId} className="blocked-user-item">
                  <div className="user-info">
                    <div className="user-avatar">
                      <span>?</span>
                    </div>
                    <div className="user-details">
                      <div className="user-name">Blocked User</div>
                      <div className="user-id">ID: {userId}</div>
                    </div>
                  </div>
                  <button 
                    className="unblock-btn"
                    onClick={() => handleUnblockUser(userId)}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Security */}
      <div className="settings-section">
        <h3>Security</h3>
        
        <div className="security-setting">
          <div className="setting-header">
            <span className="setting-title">Two-factor authentication</span>
            <span className={`security-status ${settings.twoFactorAuth ? 'enabled' : 'disabled'}`}>
              {settings.twoFactorAuth ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="setting-description">
            Add an extra layer of security to your account
          </p>
          <button 
            className="btn-secondary"
            onClick={() => setShowTwoFactorSetup(true)}
          >
            {settings.twoFactorAuth ? 'Manage' : 'Enable'} 2FA
          </button>
        </div>

        <div className="security-setting">
          <label>Session timeout</label>
          <select
            value={settings.sessionTimeout}
            onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
            className="privacy-select"
          >
            {sessionTimeoutOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="setting-description">
            Automatically log out after period of inactivity
          </small>
        </div>
      </div>

      {/* Data & Account */}
      <div className="settings-section">
        <h3>Data and account</h3>
        
        <div className="data-setting">
          <div className="setting-header">
            <span className="setting-title">Download my data</span>
            {settings.dataDownload && (
              <span className="data-status">Requested</span>
            )}
          </div>
          <p className="setting-description">
            Get a copy of all your data including messages, media, and settings
          </p>
          <button 
            className="btn-secondary"
            onClick={handleRequestDataDownload}
            disabled={settings.dataDownload}
          >
            {settings.dataDownload ? 'Download Requested' : 'Request Download'}
          </button>
        </div>

        <div className="data-setting danger">
          <div className="setting-header">
            <span className="setting-title">Delete my account</span>
            {settings.accountDeletion && (
              <span className="data-status danger">Deletion Scheduled</span>
            )}
          </div>
          <p className="setting-description">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button 
            className="btn-danger"
            onClick={handleAccountDeletion}
            disabled={settings.accountDeletion}
          >
            {settings.accountDeletion ? 'Deletion Scheduled' : 'Delete Account'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="privacy-actions">
        <button 
          className="btn-secondary"
          onClick={handleReset}
          disabled={!hasChanges || saving}
        >
          Reset Changes
        </button>
        <button 
          className="btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </div>
  );
}
