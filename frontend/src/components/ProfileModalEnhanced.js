import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import AvatarUpload from './AvatarUpload';
import toast from 'react-hot-toast';

export default function ProfileModalEnhanced({ isOpen, onClose }) {
  const { user, updateProfile, updatePreferences, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [status, setStatus] = useState(user?.status || '');
  const [email, setEmail] = useState(user?.email || '');
  
  // Preferences state
  const [preferences, setPreferences] = useState({
    theme: user?.preferences?.theme || 'dark',
    language: user?.preferences?.language || 'en',
    notifications: {
      messageSound: user?.preferences?.notifications?.messageSound ?? true,
      emailNotifications: user?.preferences?.notifications?.emailNotifications ?? true,
      pushNotifications: user?.preferences?.notifications?.pushNotifications ?? true
    },
    privacy: {
      lastSeen: user?.preferences?.privacy?.lastSeen || 'everyone',
      profilePhoto: user?.preferences?.privacy?.profilePhoto || 'everyone',
      status: user?.preferences?.privacy?.status || 'everyone'
    }
  });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setStatus(user.status || '');
      setEmail(user.email || '');
      setPreferences({
        theme: user.preferences?.theme || 'dark',
        language: user.preferences?.language || 'en',
        notifications: {
          messageSound: user.preferences?.notifications?.messageSound ?? true,
          emailNotifications: user.preferences?.notifications?.emailNotifications ?? true,
          pushNotifications: user.preferences?.notifications?.pushNotifications ?? true
        },
        privacy: {
          lastSeen: user.preferences?.privacy?.lastSeen || 'everyone',
          profilePhoto: user.preferences?.privacy?.profilePhoto || 'everyone',
          status: user.preferences?.privacy?.status || 'everyone'
        }
      });
    }
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    
    const result = await updateProfile({ name, status, email });
    if (result.ok) {
      toast.success('Profile updated successfully');
    } else {
      toast.error(result.message);
    }
  };

  const handlePreferencesSave = async () => {
    const result = await updatePreferences(preferences);
    if (result.ok) {
      toast.success('Preferences updated successfully');
    } else {
      toast.error(result.message);
    }
  };

  const handleAvatarUpdate = (avatarUrl, updatedUser) => {
    // Avatar update is handled by the AvatarUpload component
    // User state is automatically updated through the auth context
  };

  const updatePreference = (path, value) => {
    setPreferences(prev => {
      const newPrefs = { ...prev };
      const keys = path.split('.');
      let current = newPrefs;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="profile-tabs">
            <button 
              className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button 
              className={`tab ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              Preferences
            </button>
            <button 
              className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              Privacy
            </button>
          </div>

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="profile-form">
              <div className="avatar-section">
                <AvatarUpload
                  currentAvatar={user?.avatarUrl || user?.avatar}
                  onAvatarUpdate={handleAvatarUpdate}
                  size="large"
                />
              </div>

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="form-input"
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={user?.phoneNumber || ''}
                  disabled
                  className="form-input disabled"
                />
                <small className="muted">Phone number cannot be changed</small>
              </div>

              <div className="form-group">
                <label>Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="your@email.com"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <textarea
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Hey there! I am using WhatsApp Clone."
                  className="form-textarea"
                  rows={3}
                  maxLength={500}
                />
                <small className="muted">{status.length}/500 characters</small>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="preferences-form">
              <div className="form-group">
                <label>Theme</label>
                <select
                  value={preferences.theme}
                  onChange={(e) => updatePreference('theme', e.target.value)}
                  className="form-select"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div className="form-group">
                <label>Language</label>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreference('language', e.target.value)}
                  className="form-select"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              <div className="form-section">
                <h4>Notifications</h4>
                
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.notifications.messageSound}
                      onChange={(e) => updatePreference('notifications.messageSound', e.target.checked)}
                    />
                    <span>Message sounds</span>
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.notifications.emailNotifications}
                      onChange={(e) => updatePreference('notifications.emailNotifications', e.target.checked)}
                    />
                    <span>Email notifications</span>
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.notifications.pushNotifications}
                      onChange={(e) => updatePreference('notifications.pushNotifications', e.target.checked)}
                    />
                    <span>Push notifications</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handlePreferencesSave}
                  disabled={loading} 
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="privacy-form">
              <div className="form-group">
                <label>Last Seen</label>
                <select
                  value={preferences.privacy.lastSeen}
                  onChange={(e) => updatePreference('privacy.lastSeen', e.target.value)}
                  className="form-select"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
                <small className="muted">Who can see when you were last online</small>
              </div>

              <div className="form-group">
                <label>Profile Photo</label>
                <select
                  value={preferences.privacy.profilePhoto}
                  onChange={(e) => updatePreference('privacy.profilePhoto', e.target.value)}
                  className="form-select"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
                <small className="muted">Who can see your profile photo</small>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={preferences.privacy.status}
                  onChange={(e) => updatePreference('privacy.status', e.target.value)}
                  className="form-select"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
                <small className="muted">Who can see your status message</small>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handlePreferencesSave}
                  disabled={loading} 
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Privacy Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
