import React, { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';
import toast from 'react-hot-toast';

export default function NotificationSettings({ isOpen, onClose }) {
  const [settings, setSettings] = useState(notificationService.settings);
  const [permission, setPermission] = useState(notificationService.permission);
  const [doNotDisturb, setDoNotDisturb] = useState(notificationService.doNotDisturb);
  const [dndDuration, setDndDuration] = useState(60); // minutes
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings({ ...notificationService.settings });
      setPermission(notificationService.permission);
      setDoNotDisturb(notificationService.doNotDisturb);
    }
  }, [isOpen]);

  const handlePermissionRequest = async () => {
    try {
      const granted = await notificationService.requestPermission();
      setPermission(notificationService.permission);
      
      if (granted) {
        toast.success('Notification permission granted!');
      } else {
        toast.error('Notification permission denied');
      }
    } catch (error) {
      toast.error('Failed to request notification permission');
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    notificationService.updateSettings(newSettings);
  };

  const handleQuietHoursChange = (key, value) => {
    const newQuietHours = { ...settings.quietHours, [key]: value };
    const newSettings = { ...settings, quietHours: newQuietHours };
    setSettings(newSettings);
    notificationService.updateSettings(newSettings);
  };

  const handleDoNotDisturbToggle = (enabled) => {
    setDoNotDisturb(enabled);
    notificationService.setDoNotDisturb(enabled);
    
    if (enabled) {
      toast.success('Do Not Disturb enabled');
    } else {
      toast.success('Do Not Disturb disabled');
    }
  };

  const handleDoNotDisturbWithDuration = () => {
    setDoNotDisturb(true);
    notificationService.setDoNotDisturb(true, dndDuration);
    toast.success(`Do Not Disturb enabled for ${dndDuration} minutes`);
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      const success = await notificationService.testNotification();
      if (success) {
        toast.success('Test notification sent!');
      } else {
        toast.error('Failed to send test notification');
      }
    } catch (error) {
      toast.error('Error sending test notification');
    } finally {
      setTestingNotification(false);
    }
  };

  const resetToDefaults = () => {
    const defaultSettings = notificationService.loadSettings();
    setSettings(defaultSettings);
    notificationService.updateSettings(defaultSettings);
    toast.success('Settings reset to defaults');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal notification-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Notification Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Permission Status */}
          <div className="settings-section">
            <h3>Permission Status</h3>
            <div className="permission-status">
              <div className={`permission-indicator ${permission}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {permission === 'granted' ? 'Notifications Enabled' :
                   permission === 'denied' ? 'Notifications Blocked' :
                   'Permission Not Requested'}
                </span>
              </div>
              
              {permission !== 'granted' && (
                <button 
                  className="btn-primary"
                  onClick={handlePermissionRequest}
                >
                  Enable Notifications
                </button>
              )}
              
              {permission === 'granted' && (
                <button 
                  className="btn-secondary"
                  onClick={handleTestNotification}
                  disabled={testingNotification}
                >
                  {testingNotification ? 'Sending...' : 'Test Notification'}
                </button>
              )}
            </div>
          </div>

          {/* Do Not Disturb */}
          <div className="settings-section">
            <h3>Do Not Disturb</h3>
            <div className="dnd-controls">
              <div className="setting-item">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={doNotDisturb}
                    onChange={(e) => handleDoNotDisturbToggle(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">
                    {doNotDisturb ? 'Do Not Disturb is ON' : 'Do Not Disturb is OFF'}
                  </span>
                </label>
              </div>

              <div className="dnd-duration">
                <label>Enable for duration:</label>
                <div className="duration-controls">
                  <select 
                    value={dndDuration}
                    onChange={(e) => setDndDuration(Number(e.target.value))}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                    <option value={480}>8 hours</option>
                  </select>
                  <button 
                    className="btn-secondary"
                    onClick={handleDoNotDisturbWithDuration}
                  >
                    Enable
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* General Settings */}
          <div className="settings-section">
            <h3>General Settings</h3>
            
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
                  checked={settings.desktop}
                  onChange={(e) => handleSettingChange('desktop', e.target.checked)}
                  disabled={!settings.enabled}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Desktop notifications</span>
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
          </div>

          {/* Sound Settings */}
          <div className="settings-section">
            <h3>Sound Settings</h3>
            
            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) => handleSettingChange('sound', e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Notification sounds</span>
              </label>
            </div>

            <div className="setting-item">
              <label>Sound Volume</label>
              <div className="volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.soundVolume}
                  onChange={(e) => handleSettingChange('soundVolume', parseFloat(e.target.value))}
                  disabled={!settings.sound}
                />
                <span className="volume-value">
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </div>
            </div>

            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.vibrate}
                  onChange={(e) => handleSettingChange('vibrate', e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Vibration (mobile)</span>
              </label>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="settings-section">
            <h3>Quiet Hours</h3>
            
            <div className="setting-item">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.quietHours.enabled}
                  onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">Enable quiet hours</span>
              </label>
            </div>

            {settings.quietHours.enabled && (
              <div className="quiet-hours-config">
                <div className="time-inputs">
                  <div className="time-input">
                    <label>Start time</label>
                    <input
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                    />
                  </div>
                  <div className="time-input">
                    <label>End time</label>
                    <input
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                    />
                  </div>
                </div>
                <p className="quiet-hours-info">
                  Notifications will be silenced during these hours
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="settings-actions">
            <button 
              className="btn-secondary"
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </button>
            <button 
              className="btn-primary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
