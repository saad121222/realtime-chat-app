import React, { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';
import toast from 'react-hot-toast';

export default function ChatNotificationSettings({ isOpen, onClose, chat }) {
  const [settings, setSettings] = useState({});
  const [muteOptions, setMuteOptions] = useState([
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '8 hours', value: 480 },
    { label: '1 week', value: 10080 },
    { label: 'Until I turn it back on', value: -1 }
  ]);

  useEffect(() => {
    if (isOpen && chat) {
      const chatSettings = notificationService.getChatSettings(chat._id);
      setSettings(chatSettings);
    }
  }, [isOpen, chat]);

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    notificationService.updateChatSettings(chat._id, newSettings);
    
    // Show feedback
    const settingNames = {
      enabled: 'Notifications',
      sound: 'Sound',
      preview: 'Message preview',
      priority: 'Priority'
    };
    
    toast.success(`${settingNames[key]} ${value ? 'enabled' : 'disabled'} for ${chat.name}`);
  };

  const handleMuteChat = (minutes) => {
    if (minutes === -1) {
      // Mute indefinitely
      handleSettingChange('enabled', false);
      toast.success(`${chat.name} muted indefinitely`);
    } else {
      // Mute for specific duration
      handleSettingChange('enabled', false);
      
      // Set timer to re-enable notifications
      setTimeout(() => {
        const updatedSettings = { ...settings, enabled: true };
        notificationService.updateChatSettings(chat._id, updatedSettings);
        toast.success(`${chat.name} unmuted automatically`);
      }, minutes * 60 * 1000);
      
      toast.success(`${chat.name} muted for ${getMuteDurationText(minutes)}`);
    }
    
    onClose();
  };

  const handleUnmuteChat = () => {
    handleSettingChange('enabled', true);
    toast.success(`${chat.name} unmuted`);
  };

  const getMuteDurationText = (minutes) => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
    return `${Math.floor(minutes / 1440)} days`;
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'High - Always notify, even in Do Not Disturb';
      case 'normal': return 'Normal - Standard notifications';
      case 'muted': return 'Muted - No notifications';
      default: return 'Normal';
    }
  };

  if (!isOpen || !chat) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chat-notification-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="chat-info">
            <div className="chat-avatar">
              {chat.avatar ? (
                <img src={chat.avatar} alt={chat.name} />
              ) : (
                <span>{(chat.name || '?').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2>{chat.name}</h2>
              <p>Notification Settings</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Quick Actions */}
          <div className="quick-actions">
            {settings.enabled ? (
              <div className="mute-section">
                <h3>Mute Notifications</h3>
                <div className="mute-options">
                  {muteOptions.map((option) => (
                    <button
                      key={option.value}
                      className="mute-option"
                      onClick={() => handleMuteChat(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="unmute-section">
                <div className="muted-status">
                  <span className="mute-icon">🔕</span>
                  <div>
                    <h3>Notifications are muted</h3>
                    <p>You won't receive notifications from this chat</p>
                  </div>
                </div>
                <button 
                  className="btn-primary unmute-btn"
                  onClick={handleUnmuteChat}
                >
                  Unmute Notifications
                </button>
              </div>
            )}
          </div>

          {/* Detailed Settings */}
          <div className="detailed-settings">
            <h3>Notification Preferences</h3>
            
            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Enable notifications</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) => handleSettingChange('sound', e.target.checked)}
                  disabled={!settings.enabled}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Notification sound</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.preview}
                  onChange={(e) => handleSettingChange('preview', e.target.checked)}
                  disabled={!settings.enabled}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Show message preview</span>
              </label>
            </div>

            <div className="setting-item">
              <label>Notification Priority</label>
              <select
                value={settings.priority}
                onChange={(e) => handleSettingChange('priority', e.target.value)}
                disabled={!settings.enabled}
                className="priority-select"
              >
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
                <option value="muted">Muted</option>
              </select>
              <p className="priority-description">
                {getPriorityText(settings.priority)}
              </p>
            </div>

            {/* Group-specific settings */}
            {chat.chatType === 'group' && (
              <>
                <div className="setting-item">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.mentionsOnly || false}
                      onChange={(e) => handleSettingChange('mentionsOnly', e.target.checked)}
                      disabled={!settings.enabled}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">Only notify when mentioned</span>
                  </label>
                  <p className="setting-description">
                    Only receive notifications when someone mentions you in the group
                  </p>
                </div>

                <div className="setting-item">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.adminMessagesOnly || false}
                      onChange={(e) => handleSettingChange('adminMessagesOnly', e.target.checked)}
                      disabled={!settings.enabled}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">Only admin messages</span>
                  </label>
                  <p className="setting-description">
                    Only receive notifications for messages from group admins
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Custom Notification Tone */}
          <div className="custom-tone-section">
            <h3>Custom Notification Tone</h3>
            <div className="tone-options">
              <select
                value={settings.customTone || 'default'}
                onChange={(e) => handleSettingChange('customTone', e.target.value)}
                disabled={!settings.enabled || !settings.sound}
              >
                <option value="default">Default</option>
                <option value="message">Message</option>
                <option value="mention">Mention</option>
                <option value="notification">Notification</option>
                <option value="none">None</option>
              </select>
              <button 
                className="test-tone-btn"
                disabled={!settings.enabled || !settings.sound}
                onClick={() => {
                  const tone = settings.customTone || 'message';
                  notificationService.playSound(tone, chat._id);
                }}
              >
                Test
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="notification-stats">
            <h3>Notification Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total notifications</span>
                <span className="stat-value">{settings.totalNotifications || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">This week</span>
                <span className="stat-value">{settings.weeklyNotifications || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Last notification</span>
                <span className="stat-value">
                  {settings.lastNotification 
                    ? new Date(settings.lastNotification).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
