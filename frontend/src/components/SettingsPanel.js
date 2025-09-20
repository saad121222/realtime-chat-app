import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import ProfileSettings from './ProfileSettings';
import PrivacySettings from './PrivacySettings';
import NotificationSettings from './NotificationSettings';
import ThemeSettings from './ThemeSettings';
import LanguageSettings from './LanguageSettings';
import DataUsageSettings from './DataUsageSettings';
import toast from 'react-hot-toast';

export default function SettingsPanel({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'theme', label: 'Theme', icon: '🎨' },
    { id: 'language', label: 'Language', icon: '🌐' },
    { id: 'data', label: 'Data Usage', icon: '📊' }
  ];

  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);

  const handleTabChange = (tabId) => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        setActiveTab(tabId);
        setHasUnsavedChanges(false);
      }
    } else {
      setActiveTab(tabId);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
        setHasUnsavedChanges(false);
      }
    } else {
      onClose();
    }
  };

  const handleUnsavedChanges = (hasChanges) => {
    setHasUnsavedChanges(hasChanges);
  };

  const renderTabContent = () => {
    const commonProps = {
      onUnsavedChanges: handleUnsavedChanges
    };

    switch (activeTab) {
      case 'profile':
        return <ProfileSettings {...commonProps} />;
      case 'privacy':
        return <PrivacySettings {...commonProps} />;
      case 'notifications':
        return <NotificationSettings isOpen={true} onClose={() => {}} {...commonProps} />;
      case 'theme':
        return <ThemeSettings {...commonProps} />;
      case 'language':
        return <LanguageSettings {...commonProps} />;
      case 'data':
        return <DataUsageSettings {...commonProps} />;
      default:
        return <ProfileSettings {...commonProps} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal settings-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="settings-header">
            <h2>Settings</h2>
            {hasUnsavedChanges && (
              <span className="unsaved-indicator">
                <span className="unsaved-dot"></span>
                Unsaved changes
              </span>
            )}
          </div>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="settings-content">
          {/* Settings Navigation */}
          <div className="settings-nav">
            <div className="user-info-header">
              <div className="user-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <span>{(user?.name || '?').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.name}</div>
                <div className="user-status">{user?.status || 'Available'}</div>
              </div>
            </div>

            <nav className="settings-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                  {tab.id === 'notifications' && hasUnsavedChanges && (
                    <span className="tab-indicator"></span>
                  )}
                </button>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="quick-action-btn" title="Export Data">
                <span className="action-icon">📤</span>
                Export Data
              </button>
              <button className="quick-action-btn" title="Import Settings">
                <span className="action-icon">📥</span>
                Import Settings
              </button>
              <button className="quick-action-btn danger" title="Reset All Settings">
                <span className="action-icon">🔄</span>
                Reset All
              </button>
            </div>
          </div>

          {/* Settings Content */}
          <div className="settings-main">
            <div className="settings-tab-content">
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* Settings Footer */}
        <div className="settings-footer">
          <div className="app-info">
            <span className="app-version">WhatsApp Clone v1.0.0</span>
            <span className="build-info">Build 2024.01.01</span>
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
