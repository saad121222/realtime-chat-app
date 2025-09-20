import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ThemeSettings({ onUnsavedChanges }) {
  const [settings, setSettings] = useState({
    theme: 'dark',
    accentColor: '#25d366',
    fontSize: 'medium',
    chatWallpaper: 'default',
    customWallpaper: '',
    messageStyle: 'bubbles',
    compactMode: false,
    animations: true,
    highContrast: false,
    colorBlindMode: false
  });
  const [originalSettings, setOriginalSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const themes = [
    { 
      id: 'light', 
      name: 'Light', 
      description: 'Clean and bright interface',
      preview: '#ffffff'
    },
    { 
      id: 'dark', 
      name: 'Dark', 
      description: 'Easy on the eyes in low light',
      preview: '#0b141a'
    },
    { 
      id: 'auto', 
      name: 'Auto', 
      description: 'Follows system preference',
      preview: 'linear-gradient(45deg, #ffffff 50%, #0b141a 50%)'
    },
    { 
      id: 'black', 
      name: 'Pure Black', 
      description: 'True black for OLED displays',
      preview: '#000000'
    }
  ];

  const accentColors = [
    { name: 'WhatsApp Green', value: '#25d366' },
    { name: 'Blue', value: '#007bff' },
    { name: 'Purple', value: '#6f42c1' },
    { name: 'Pink', value: '#e83e8c' },
    { name: 'Red', value: '#dc3545' },
    { name: 'Orange', value: '#fd7e14' },
    { name: 'Yellow', value: '#ffc107' },
    { name: 'Teal', value: '#20c997' }
  ];

  const fontSizes = [
    { id: 'small', name: 'Small', size: '14px' },
    { id: 'medium', name: 'Medium', size: '16px' },
    { id: 'large', name: 'Large', size: '18px' },
    { id: 'extra-large', name: 'Extra Large', size: '20px' }
  ];

  const wallpapers = [
    { id: 'default', name: 'Default', preview: 'url("data:image/svg+xml,%3Csvg width%3D%274%27 height%3D%274%27 viewBox%3D%270 0 4 4%27 xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath d%3D%27M0 0h4v4H0z%27 fill%3D%27%230b141a%27/%3E%3Cpath d%3D%27M0 0h2v2H0zM2 2h2v2H2z%27 fill%3D%27%23081014%27/%3E%3C/svg%3E")' },
    { id: 'geometric', name: 'Geometric', preview: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)' },
    { id: 'gradient', name: 'Gradient', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'minimal', name: 'Minimal', preview: '#f8f9fa' },
    { id: 'custom', name: 'Custom', preview: '#25d366' }
  ];

  const messageStyles = [
    { id: 'bubbles', name: 'Bubbles', description: 'Traditional chat bubbles' },
    { id: 'minimal', name: 'Minimal', description: 'Clean, borderless messages' },
    { id: 'compact', name: 'Compact', description: 'Space-efficient layout' }
  ];

  useEffect(() => {
    // Load theme settings from localStorage
    const savedSettings = localStorage.getItem('themeSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setOriginalSettings(parsed);
      applyTheme(parsed);
    } else {
      setOriginalSettings(settings);
      applyTheme(settings);
    }
  }, []);

  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    onUnsavedChanges?.(hasChanges);
  }, [settings, originalSettings, onUnsavedChanges]);

  const handleSettingChange = (key, value) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    setSettings(newSettings);
    
    // Apply theme changes immediately for preview
    applyTheme(newSettings);
  };

  const applyTheme = (themeSettings) => {
    const root = document.documentElement;
    
    // Apply theme
    root.setAttribute('data-theme', themeSettings.theme);
    
    // Apply accent color
    root.style.setProperty('--accent-color', themeSettings.accentColor);
    
    // Apply font size
    const fontSizeMap = {
      'small': '14px',
      'medium': '16px',
      'large': '18px',
      'extra-large': '20px'
    };
    root.style.setProperty('--base-font-size', fontSizeMap[themeSettings.fontSize]);
    
    // Apply wallpaper
    if (themeSettings.chatWallpaper === 'custom' && themeSettings.customWallpaper) {
      root.style.setProperty('--chat-wallpaper', `url(${themeSettings.customWallpaper})`);
    } else {
      const wallpaper = wallpapers.find(w => w.id === themeSettings.chatWallpaper);
      if (wallpaper) {
        root.style.setProperty('--chat-wallpaper', wallpaper.preview);
      }
    }
    
    // Apply other settings
    root.classList.toggle('compact-mode', themeSettings.compactMode);
    root.classList.toggle('no-animations', !themeSettings.animations);
    root.classList.toggle('high-contrast', themeSettings.highContrast);
    root.classList.toggle('colorblind-mode', themeSettings.colorBlindMode);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('themeSettings', JSON.stringify(settings));
      setOriginalSettings(settings);
      applyTheme(settings);
      toast.success('Theme settings saved successfully');
    } catch (error) {
      toast.error('Failed to save theme settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all theme settings to default?')) {
      const defaultSettings = {
        theme: 'dark',
        accentColor: '#25d366',
        fontSize: 'medium',
        chatWallpaper: 'default',
        customWallpaper: '',
        messageStyle: 'bubbles',
        compactMode: false,
        animations: true,
        highContrast: false,
        colorBlindMode: false
      };
      setSettings(defaultSettings);
      applyTheme(defaultSettings);
    }
  };

  const handleWallpaperUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        handleSettingChange('customWallpaper', e.target.result);
        handleSettingChange('chatWallpaper', 'custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="theme-settings">
      {/* Theme Selection */}
      <div className="settings-section">
        <h3>Theme</h3>
        <div className="theme-grid">
          {themes.map(theme => (
            <label key={theme.id} className="theme-option">
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={settings.theme === theme.id}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
              />
              <div className="theme-preview" style={{ background: theme.preview }}>
                <div className="theme-content">
                  <div className="theme-name">{theme.name}</div>
                  <div className="theme-description">{theme.description}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="settings-section">
        <h3>Accent Color</h3>
        <div className="color-grid">
          {accentColors.map(color => (
            <label key={color.value} className="color-option">
              <input
                type="radio"
                name="accentColor"
                value={color.value}
                checked={settings.accentColor === color.value}
                onChange={(e) => handleSettingChange('accentColor', e.target.value)}
              />
              <div 
                className="color-preview" 
                style={{ backgroundColor: color.value }}
                title={color.name}
              >
                {settings.accentColor === color.value && (
                  <span className="color-check">✓</span>
                )}
              </div>
            </label>
          ))}
        </div>
        
        <div className="custom-color">
          <label htmlFor="customColor">Custom Color:</label>
          <input
            id="customColor"
            type="color"
            value={settings.accentColor}
            onChange={(e) => handleSettingChange('accentColor', e.target.value)}
            className="color-picker"
          />
        </div>
      </div>

      {/* Font Size */}
      <div className="settings-section">
        <h3>Font Size</h3>
        <div className="font-size-options">
          {fontSizes.map(size => (
            <label key={size.id} className="font-size-option">
              <input
                type="radio"
                name="fontSize"
                value={size.id}
                checked={settings.fontSize === size.id}
                onChange={(e) => handleSettingChange('fontSize', e.target.value)}
              />
              <div className="font-preview" style={{ fontSize: size.size }}>
                <span className="font-name">{size.name}</span>
                <span className="font-sample">Sample text</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Chat Wallpaper */}
      <div className="settings-section">
        <h3>Chat Wallpaper</h3>
        <div className="wallpaper-grid">
          {wallpapers.map(wallpaper => (
            <label key={wallpaper.id} className="wallpaper-option">
              <input
                type="radio"
                name="chatWallpaper"
                value={wallpaper.id}
                checked={settings.chatWallpaper === wallpaper.id}
                onChange={(e) => handleSettingChange('chatWallpaper', e.target.value)}
              />
              <div 
                className="wallpaper-preview" 
                style={{ background: wallpaper.preview }}
              >
                <span className="wallpaper-name">{wallpaper.name}</span>
                {settings.chatWallpaper === wallpaper.id && (
                  <span className="wallpaper-check">✓</span>
                )}
              </div>
            </label>
          ))}
        </div>

        {settings.chatWallpaper === 'custom' && (
          <div className="custom-wallpaper">
            <label htmlFor="wallpaperUpload">Upload Custom Wallpaper:</label>
            <input
              id="wallpaperUpload"
              type="file"
              accept="image/*"
              onChange={handleWallpaperUpload}
              className="file-input"
            />
            <small className="form-hint">Maximum file size: 5MB</small>
          </div>
        )}
      </div>

      {/* Message Style */}
      <div className="settings-section">
        <h3>Message Style</h3>
        <div className="message-style-options">
          {messageStyles.map(style => (
            <label key={style.id} className="message-style-option">
              <input
                type="radio"
                name="messageStyle"
                value={style.id}
                checked={settings.messageStyle === style.id}
                onChange={(e) => handleSettingChange('messageStyle', e.target.value)}
              />
              <div className="style-content">
                <span className="style-name">{style.name}</span>
                <span className="style-description">{style.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Display Options */}
      <div className="settings-section">
        <h3>Display Options</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Compact mode</span>
          </label>
          <small className="setting-description">
            Reduce spacing and padding for more content on screen
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.animations}
              onChange={(e) => handleSettingChange('animations', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Animations</span>
          </label>
          <small className="setting-description">
            Enable smooth transitions and animations
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">High contrast</span>
          </label>
          <small className="setting-description">
            Increase contrast for better visibility
          </small>
        </div>

        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.colorBlindMode}
              onChange={(e) => handleSettingChange('colorBlindMode', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Color blind friendly</span>
          </label>
          <small className="setting-description">
            Adjust colors for color vision deficiency
          </small>
        </div>
      </div>

      {/* Theme Preview */}
      <div className="settings-section">
        <h3>Preview</h3>
        <div className="theme-preview-container">
          <div className="preview-chat">
            <div className="preview-header">
              <div className="preview-avatar"></div>
              <div className="preview-info">
                <div className="preview-name">Contact Name</div>
                <div className="preview-status">Online</div>
              </div>
            </div>
            <div className="preview-messages">
              <div className="preview-message received">
                <div className="message-content">Hey there! How are you?</div>
              </div>
              <div className="preview-message sent">
                <div className="message-content">I'm doing great, thanks!</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="theme-actions">
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
          {saving ? 'Saving...' : 'Save Theme'}
        </button>
      </div>
    </div>
  );
}
