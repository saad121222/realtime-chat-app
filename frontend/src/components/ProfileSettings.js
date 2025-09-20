import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import AvatarUpload from './AvatarUpload';
import toast from 'react-hot-toast';

export default function ProfileSettings({ onUnsavedChanges }) {
  const { user, updateProfile, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    status: '',
    bio: '',
    avatar: ''
  });
  const [originalData, setOriginalData] = useState({});
  const [saving, setSaving] = useState(false);

  const statusOptions = [
    { value: 'available', label: 'Available', emoji: '🟢' },
    { value: 'busy', label: 'Busy', emoji: '🔴' },
    { value: 'away', label: 'Away', emoji: '🟡' },
    { value: 'offline', label: 'Appear Offline', emoji: '⚫' },
    { value: 'custom', label: 'Custom Status', emoji: '✏️' }
  ];

  useEffect(() => {
    if (user) {
      const userData = {
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        status: user.status || 'available',
        bio: user.bio || '',
        avatar: user.avatar || ''
      };
      setFormData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
    onUnsavedChanges?.(hasChanges);
  }, [formData, originalData, onUnsavedChanges]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpdate = (avatarUrl) => {
    handleInputChange('avatar', avatarUrl);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(formData);
      setOriginalData(formData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all changes?')) {
      setFormData(originalData);
    }
  };

  const getCharacterCount = (text, max) => {
    return `${text.length}/${max}`;
  };

  const isFormValid = () => {
    return formData.name.trim().length > 0 && 
           formData.name.length <= 50 &&
           formData.bio.length <= 500;
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  return (
    <div className="profile-settings">
      <div className="settings-section">
        <h3>Profile Information</h3>
        
        {/* Avatar Section */}
        <div className="avatar-section">
          <AvatarUpload
            currentAvatar={formData.avatar}
            onAvatarUpdate={handleAvatarUpdate}
            size="large"
          />
          <div className="avatar-info">
            <h4>Profile Photo</h4>
            <p>Upload a profile photo to help others recognize you</p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="form-group">
          <label htmlFor="name">Display Name *</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="form-input"
            maxLength={50}
            placeholder="Enter your display name"
          />
          <small className="char-count">{getCharacterCount(formData.name, 50)}</small>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="form-input"
            placeholder="Enter your email address"
            disabled={loading}
          />
          <small className="form-hint">Email cannot be changed after registration</small>
        </div>

        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            id="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
            className="form-input"
            placeholder="Enter your phone number"
            disabled={loading}
          />
          <small className="form-hint">Phone number cannot be changed after verification</small>
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            className="form-textarea"
            rows={3}
            maxLength={500}
            placeholder="Tell others about yourself..."
          />
          <small className="char-count">{getCharacterCount(formData.bio, 500)}</small>
        </div>
      </div>

      {/* Status Section */}
      <div className="settings-section">
        <h3>Status & Availability</h3>
        
        <div className="status-options">
          {statusOptions.map(option => (
            <label key={option.value} className="status-option">
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={formData.status === option.value}
                onChange={(e) => handleInputChange('status', e.target.value)}
              />
              <div className="status-content">
                <span className="status-emoji">{option.emoji}</span>
                <span className="status-label">{option.label}</span>
              </div>
            </label>
          ))}
        </div>

        {formData.status === 'custom' && (
          <div className="form-group">
            <label htmlFor="customStatus">Custom Status Message</label>
            <input
              id="customStatus"
              type="text"
              value={formData.customStatus || ''}
              onChange={(e) => handleInputChange('customStatus', e.target.value)}
              className="form-input"
              maxLength={100}
              placeholder="What's on your mind?"
            />
            <small className="char-count">{getCharacterCount(formData.customStatus || '', 100)}</small>
          </div>
        )}
      </div>

      {/* Account Information */}
      <div className="settings-section">
        <h3>Account Information</h3>
        
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Member since</span>
            <span className="info-value">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Last active</span>
            <span className="info-value">
              {user?.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Now'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Account ID</span>
            <span className="info-value">{user?.id || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Profile Visibility */}
      <div className="settings-section">
        <h3>Profile Visibility</h3>
        
        <div className="visibility-options">
          <div className="setting-item">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.showEmail || false}
                onChange={(e) => handleInputChange('showEmail', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Show email to contacts</span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.showPhone || false}
                onChange={(e) => handleInputChange('showPhone', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Show phone number to contacts</span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.showLastSeen !== false}
                onChange={(e) => handleInputChange('showLastSeen', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Show last seen status</span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={formData.allowSearchByEmail || false}
                onChange={(e) => handleInputChange('allowSearchByEmail', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Allow others to find me by email</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="profile-actions">
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
          disabled={!hasChanges || !isFormValid() || saving}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
