import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function DataUsageSettings({ onUnsavedChanges }) {
  const [settings, setSettings] = useState({
    autoDownloadWifi: {
      photos: true,
      videos: false,
      documents: false,
      audio: true
    },
    autoDownloadMobile: {
      photos: false,
      videos: false,
      documents: false,
      audio: false
    },
    autoDownloadRoaming: {
      photos: false,
      videos: false,
      documents: false,
      audio: false
    },
    mediaQuality: {
      photoUpload: 'high',
      videoUpload: 'medium',
      videoCall: 'auto'
    },
    dataLimits: {
      enabled: false,
      dailyLimit: 100, // MB
      monthlyLimit: 1000, // MB
      warningThreshold: 80 // percentage
    },
    backgroundSync: true,
    lowDataMode: false,
    compressionLevel: 'medium',
    cacheSize: 500, // MB
    autoCleanup: true,
    cleanupInterval: 7 // days
  });
  const [originalSettings, setOriginalSettings] = useState({});
  const [usage, setUsage] = useState({
    today: { sent: 0, received: 0, total: 0 },
    thisWeek: { sent: 0, received: 0, total: 0 },
    thisMonth: { sent: 0, received: 0, total: 0 },
    breakdown: {
      messages: 0,
      photos: 0,
      videos: 0,
      documents: 0,
      audio: 0,
      calls: 0
    }
  });
  const [saving, setSaving] = useState(false);
  const [showUsageDetails, setShowUsageDetails] = useState(false);

  const mediaTypes = [
    { key: 'photos', label: 'Photos', icon: '📷' },
    { key: 'videos', label: 'Videos', icon: '🎥' },
    { key: 'documents', label: 'Documents', icon: '📄' },
    { key: 'audio', label: 'Audio', icon: '🎵' }
  ];

  const qualityOptions = {
    photoUpload: [
      { value: 'low', label: 'Low (Fast upload)', description: 'Compressed for quick sending' },
      { value: 'medium', label: 'Medium (Balanced)', description: 'Good quality with reasonable size' },
      { value: 'high', label: 'High (Best quality)', description: 'Original quality, larger files' }
    ],
    videoUpload: [
      { value: 'low', label: 'Low (360p)', description: 'Fastest upload, lowest data usage' },
      { value: 'medium', label: 'Medium (720p)', description: 'Balanced quality and size' },
      { value: 'high', label: 'High (1080p)', description: 'Best quality, highest data usage' }
    ],
    videoCall: [
      { value: 'low', label: 'Low quality', description: 'Saves data, lower video quality' },
      { value: 'medium', label: 'Medium quality', description: 'Balanced quality and data usage' },
      { value: 'high', label: 'High quality', description: 'Best quality, uses more data' },
      { value: 'auto', label: 'Auto', description: 'Adjusts based on connection' }
    ]
  };

  const compressionLevels = [
    { value: 'none', label: 'No compression', description: 'Original files, highest data usage' },
    { value: 'low', label: 'Low compression', description: 'Minimal compression, good quality' },
    { value: 'medium', label: 'Medium compression', description: 'Balanced compression and quality' },
    { value: 'high', label: 'High compression', description: 'Maximum compression, saves data' }
  ];

  useEffect(() => {
    // Load data usage settings from localStorage
    const savedSettings = localStorage.getItem('dataUsageSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setOriginalSettings(parsed);
    } else {
      setOriginalSettings(settings);
    }

    // Load usage statistics
    loadUsageStatistics();
  }, []);

  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    onUnsavedChanges?.(hasChanges);
  }, [settings, originalSettings, onUnsavedChanges]);

  const loadUsageStatistics = () => {
    // Simulate loading usage data
    const mockUsage = {
      today: { 
        sent: Math.floor(Math.random() * 50) + 10, 
        received: Math.floor(Math.random() * 100) + 20, 
        total: 0 
      },
      thisWeek: { 
        sent: Math.floor(Math.random() * 200) + 50, 
        received: Math.floor(Math.random() * 400) + 100, 
        total: 0 
      },
      thisMonth: { 
        sent: Math.floor(Math.random() * 800) + 200, 
        received: Math.floor(Math.random() * 1500) + 500, 
        total: 0 
      },
      breakdown: {
        messages: Math.floor(Math.random() * 10) + 5,
        photos: Math.floor(Math.random() * 100) + 20,
        videos: Math.floor(Math.random() * 200) + 50,
        documents: Math.floor(Math.random() * 50) + 10,
        audio: Math.floor(Math.random() * 30) + 5,
        calls: Math.floor(Math.random() * 150) + 30
      }
    };

    // Calculate totals
    mockUsage.today.total = mockUsage.today.sent + mockUsage.today.received;
    mockUsage.thisWeek.total = mockUsage.thisWeek.sent + mockUsage.thisWeek.received;
    mockUsage.thisMonth.total = mockUsage.thisMonth.sent + mockUsage.thisMonth.received;

    setUsage(mockUsage);
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNestedSettingChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleAutoDownloadChange = (network, mediaType, enabled) => {
    setSettings(prev => ({
      ...prev,
      [`autoDownload${network}`]: {
        ...prev[`autoDownload${network}`],
        [mediaType]: enabled
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('dataUsageSettings', JSON.stringify(settings));
      setOriginalSettings(settings);
      toast.success('Data usage settings saved successfully');
    } catch (error) {
      toast.error('Failed to save data usage settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all data usage settings to default?')) {
      const defaultSettings = {
        autoDownloadWifi: { photos: true, videos: false, documents: false, audio: true },
        autoDownloadMobile: { photos: false, videos: false, documents: false, audio: false },
        autoDownloadRoaming: { photos: false, videos: false, documents: false, audio: false },
        mediaQuality: { photoUpload: 'high', videoUpload: 'medium', videoCall: 'auto' },
        dataLimits: { enabled: false, dailyLimit: 100, monthlyLimit: 1000, warningThreshold: 80 },
        backgroundSync: true,
        lowDataMode: false,
        compressionLevel: 'medium',
        cacheSize: 500,
        autoCleanup: true,
        cleanupInterval: 7
      };
      setSettings(defaultSettings);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all cached media files? This will free up storage space but may require re-downloading files.')) {
      try {
        // Simulate cache clearing
        toast.success('Cache cleared successfully');
        loadUsageStatistics(); // Refresh usage stats
      } catch (error) {
        toast.error('Failed to clear cache');
      }
    }
  };

  const handleResetUsageStats = () => {
    if (window.confirm('Reset all usage statistics? This action cannot be undone.')) {
      setUsage({
        today: { sent: 0, received: 0, total: 0 },
        thisWeek: { sent: 0, received: 0, total: 0 },
        thisMonth: { sent: 0, received: 0, total: 0 },
        breakdown: { messages: 0, photos: 0, videos: 0, documents: 0, audio: 0, calls: 0 }
      });
      toast.success('Usage statistics reset');
    }
  };

  const formatDataSize = (sizeInMB) => {
    if (sizeInMB < 1) return `${(sizeInMB * 1024).toFixed(0)} KB`;
    if (sizeInMB < 1024) return `${sizeInMB.toFixed(1)} MB`;
    return `${(sizeInMB / 1024).toFixed(1)} GB`;
  };

  const getUsagePercentage = (used, limit) => {
    return Math.min((used / limit) * 100, 100);
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="data-usage-settings">
      {/* Usage Overview */}
      <div className="settings-section">
        <h3>Data Usage Overview</h3>
        
        <div className="usage-cards">
          <div className="usage-card">
            <div className="usage-header">
              <span className="usage-period">Today</span>
              <span className="usage-total">{formatDataSize(usage.today.total)}</span>
            </div>
            <div className="usage-breakdown">
              <div className="usage-item">
                <span className="usage-label">Sent</span>
                <span className="usage-value">{formatDataSize(usage.today.sent)}</span>
              </div>
              <div className="usage-item">
                <span className="usage-label">Received</span>
                <span className="usage-value">{formatDataSize(usage.today.received)}</span>
              </div>
            </div>
          </div>

          <div className="usage-card">
            <div className="usage-header">
              <span className="usage-period">This Week</span>
              <span className="usage-total">{formatDataSize(usage.thisWeek.total)}</span>
            </div>
            <div className="usage-breakdown">
              <div className="usage-item">
                <span className="usage-label">Sent</span>
                <span className="usage-value">{formatDataSize(usage.thisWeek.sent)}</span>
              </div>
              <div className="usage-item">
                <span className="usage-label">Received</span>
                <span className="usage-value">{formatDataSize(usage.thisWeek.received)}</span>
              </div>
            </div>
          </div>

          <div className="usage-card">
            <div className="usage-header">
              <span className="usage-period">This Month</span>
              <span className="usage-total">{formatDataSize(usage.thisMonth.total)}</span>
            </div>
            <div className="usage-breakdown">
              <div className="usage-item">
                <span className="usage-label">Sent</span>
                <span className="usage-value">{formatDataSize(usage.thisMonth.sent)}</span>
              </div>
              <div className="usage-item">
                <span className="usage-label">Received</span>
                <span className="usage-value">{formatDataSize(usage.thisMonth.received)}</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          className="btn-secondary"
          onClick={() => setShowUsageDetails(!showUsageDetails)}
        >
          {showUsageDetails ? 'Hide' : 'Show'} Detailed Breakdown
        </button>

        {showUsageDetails && (
          <div className="usage-details">
            <h4>Usage by Type</h4>
            <div className="usage-breakdown-grid">
              {Object.entries(usage.breakdown).map(([type, size]) => (
                <div key={type} className="breakdown-item">
                  <span className="breakdown-type">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  <span className="breakdown-size">{formatDataSize(size)}</span>
                  <div className="breakdown-bar">
                    <div 
                      className="breakdown-progress" 
                      style={{ width: `${(size / Math.max(...Object.values(usage.breakdown))) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto-download Settings */}
      <div className="settings-section">
        <h3>Auto-download Media</h3>
        
        <div className="network-settings">
          {[
            { key: 'Wifi', label: 'Wi-Fi', icon: '📶' },
            { key: 'Mobile', label: 'Mobile Data', icon: '📱' },
            { key: 'Roaming', label: 'Roaming', icon: '🌐' }
          ].map(network => (
            <div key={network.key} className="network-section">
              <h4>
                <span className="network-icon">{network.icon}</span>
                {network.label}
              </h4>
              <div className="media-toggles">
                {mediaTypes.map(media => (
                  <div key={media.key} className="setting-item">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={settings[`autoDownload${network.key}`][media.key]}
                        onChange={(e) => handleAutoDownloadChange(network.key, media.key, e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                      <span className="toggle-text">
                        <span className="media-icon">{media.icon}</span>
                        {media.label}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Media Quality */}
      <div className="settings-section">
        <h3>Media Quality</h3>
        
        <div className="quality-setting">
          <label>Photo Upload Quality</label>
          <div className="quality-options">
            {qualityOptions.photoUpload.map(option => (
              <label key={option.value} className="quality-option">
                <input
                  type="radio"
                  name="photoUpload"
                  value={option.value}
                  checked={settings.mediaQuality.photoUpload === option.value}
                  onChange={(e) => handleNestedSettingChange('mediaQuality', 'photoUpload', e.target.value)}
                />
                <div className="quality-content">
                  <span className="quality-name">{option.label}</span>
                  <span className="quality-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="quality-setting">
          <label>Video Upload Quality</label>
          <div className="quality-options">
            {qualityOptions.videoUpload.map(option => (
              <label key={option.value} className="quality-option">
                <input
                  type="radio"
                  name="videoUpload"
                  value={option.value}
                  checked={settings.mediaQuality.videoUpload === option.value}
                  onChange={(e) => handleNestedSettingChange('mediaQuality', 'videoUpload', e.target.value)}
                />
                <div className="quality-content">
                  <span className="quality-name">{option.label}</span>
                  <span className="quality-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="quality-setting">
          <label>Video Call Quality</label>
          <div className="quality-options">
            {qualityOptions.videoCall.map(option => (
              <label key={option.value} className="quality-option">
                <input
                  type="radio"
                  name="videoCall"
                  value={option.value}
                  checked={settings.mediaQuality.videoCall === option.value}
                  onChange={(e) => handleNestedSettingChange('mediaQuality', 'videoCall', e.target.value)}
                />
                <div className="quality-content">
                  <span className="quality-name">{option.label}</span>
                  <span className="quality-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Data Limits */}
      <div className="settings-section">
        <h3>Data Limits</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.dataLimits.enabled}
              onChange={(e) => handleNestedSettingChange('dataLimits', 'enabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Enable data limits</span>
          </label>
        </div>

        {settings.dataLimits.enabled && (
          <div className="data-limits-config">
            <div className="limit-setting">
              <label>Daily Limit (MB)</label>
              <input
                type="number"
                value={settings.dataLimits.dailyLimit}
                onChange={(e) => handleNestedSettingChange('dataLimits', 'dailyLimit', parseInt(e.target.value))}
                className="limit-input"
                min="1"
                max="10000"
              />
              <div className="limit-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getUsagePercentage(usage.today.total, settings.dataLimits.dailyLimit)}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {formatDataSize(usage.today.total)} / {formatDataSize(settings.dataLimits.dailyLimit)}
                </span>
              </div>
            </div>

            <div className="limit-setting">
              <label>Monthly Limit (MB)</label>
              <input
                type="number"
                value={settings.dataLimits.monthlyLimit}
                onChange={(e) => handleNestedSettingChange('dataLimits', 'monthlyLimit', parseInt(e.target.value))}
                className="limit-input"
                min="1"
                max="100000"
              />
              <div className="limit-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getUsagePercentage(usage.thisMonth.total, settings.dataLimits.monthlyLimit)}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {formatDataSize(usage.thisMonth.total)} / {formatDataSize(settings.dataLimits.monthlyLimit)}
                </span>
              </div>
            </div>

            <div className="limit-setting">
              <label>Warning Threshold (%)</label>
              <input
                type="range"
                min="50"
                max="95"
                value={settings.dataLimits.warningThreshold}
                onChange={(e) => handleNestedSettingChange('dataLimits', 'warningThreshold', parseInt(e.target.value))}
                className="threshold-slider"
              />
              <span className="threshold-value">{settings.dataLimits.warningThreshold}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div className="settings-section">
        <h3>Advanced Settings</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.backgroundSync}
              onChange={(e) => handleSettingChange('backgroundSync', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Background sync</span>
          </label>
          <small className="setting-description">
            Sync messages and media in the background
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.lowDataMode}
              onChange={(e) => handleSettingChange('lowDataMode', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Low data mode</span>
          </label>
          <small className="setting-description">
            Reduce data usage by limiting background activities
          </small>
        </div>

        <div className="compression-setting">
          <label>Compression Level</label>
          <div className="compression-options">
            {compressionLevels.map(level => (
              <label key={level.value} className="compression-option">
                <input
                  type="radio"
                  name="compressionLevel"
                  value={level.value}
                  checked={settings.compressionLevel === level.value}
                  onChange={(e) => handleSettingChange('compressionLevel', e.target.value)}
                />
                <div className="compression-content">
                  <span className="compression-name">{level.label}</span>
                  <span className="compression-description">{level.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Storage Management */}
      <div className="settings-section">
        <h3>Storage Management</h3>
        
        <div className="storage-setting">
          <label>Cache Size Limit (MB)</label>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={settings.cacheSize}
            onChange={(e) => handleSettingChange('cacheSize', parseInt(e.target.value))}
            className="cache-slider"
          />
          <span className="cache-value">{formatDataSize(settings.cacheSize)}</span>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.autoCleanup}
              onChange={(e) => handleSettingChange('autoCleanup', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Auto cleanup old files</span>
          </label>
        </div>

        {settings.autoCleanup && (
          <div className="cleanup-setting">
            <label>Cleanup Interval (days)</label>
            <select
              value={settings.cleanupInterval}
              onChange={(e) => handleSettingChange('cleanupInterval', parseInt(e.target.value))}
              className="cleanup-select"
            >
              <option value={1}>Daily</option>
              <option value={3}>Every 3 days</option>
              <option value={7}>Weekly</option>
              <option value={14}>Every 2 weeks</option>
              <option value={30}>Monthly</option>
            </select>
          </div>
        )}

        <div className="storage-actions">
          <button className="btn-secondary" onClick={handleClearCache}>
            Clear Cache
          </button>
          <button className="btn-secondary" onClick={handleResetUsageStats}>
            Reset Usage Stats
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="data-usage-actions">
        <button 
          className="btn-secondary"
          onClick={handleReset}
          disabled={saving}
        >
          Reset to Default
        </button>
        <button 
          className="btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save Data Settings'}
        </button>
      </div>
    </div>
  );
}
