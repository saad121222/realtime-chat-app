import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function LanguageSettings({ onUnsavedChanges }) {
  const [settings, setSettings] = useState({
    language: 'en',
    region: 'US',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    numberFormat: 'en-US',
    rtlSupport: false,
    autoDetect: true
  });
  const [originalSettings, setOriginalSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' }
  ];

  const regions = {
    'en': [
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'AU', name: 'Australia', flag: '🇦🇺' }
    ],
    'es': [
      { code: 'ES', name: 'Spain', flag: '🇪🇸' },
      { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
      { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
      { code: 'CO', name: 'Colombia', flag: '🇨🇴' }
    ],
    'fr': [
      { code: 'FR', name: 'France', flag: '🇫🇷' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
      { code: 'CH', name: 'Switzerland', flag: '🇨🇭' }
    ],
    'de': [
      { code: 'DE', name: 'Germany', flag: '🇩🇪' },
      { code: 'AT', name: 'Austria', flag: '🇦🇹' },
      { code: 'CH', name: 'Switzerland', flag: '🇨🇭' }
    ]
  };

  const dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '12/31/2024' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '31/12/2024' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-12-31' },
    { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '31.12.2024' },
    { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY', example: 'Dec 31, 2024' },
    { value: 'DD MMM YYYY', label: 'DD MMM YYYY', example: '31 Dec 2024' }
  ];

  const timeFormats = [
    { value: '12h', label: '12-hour', example: '2:30 PM' },
    { value: '24h', label: '24-hour', example: '14:30' }
  ];

  useEffect(() => {
    // Load language settings from localStorage
    const savedSettings = localStorage.getItem('languageSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setOriginalSettings(parsed);
    } else {
      // Auto-detect browser language
      const browserLang = navigator.language.split('-')[0];
      const browserRegion = navigator.language.split('-')[1] || 'US';
      
      const detectedSettings = {
        ...settings,
        language: languages.find(l => l.code === browserLang) ? browserLang : 'en',
        region: browserRegion
      };
      
      setSettings(detectedSettings);
      setOriginalSettings(detectedSettings);
    }
  }, []);

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

  const handleLanguageChange = (languageCode) => {
    const language = languages.find(l => l.code === languageCode);
    const availableRegions = regions[languageCode] || [{ code: 'US', name: 'Default' }];
    
    setSettings(prev => ({
      ...prev,
      language: languageCode,
      region: availableRegions[0].code,
      rtlSupport: ['ar', 'he', 'fa', 'ur'].includes(languageCode)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('languageSettings', JSON.stringify(settings));
      setOriginalSettings(settings);
      
      // Apply language settings
      document.documentElement.lang = settings.language;
      document.documentElement.dir = settings.rtlSupport ? 'rtl' : 'ltr';
      
      toast.success('Language settings saved successfully');
      
      // Show reload prompt for full effect
      if (window.confirm('Language settings have been saved. Reload the page to apply all changes?')) {
        window.location.reload();
      }
    } catch (error) {
      toast.error('Failed to save language settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset language settings to browser defaults?')) {
      const browserLang = navigator.language.split('-')[0];
      const browserRegion = navigator.language.split('-')[1] || 'US';
      
      const defaultSettings = {
        language: languages.find(l => l.code === browserLang) ? browserLang : 'en',
        region: browserRegion,
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        numberFormat: 'en-US',
        rtlSupport: false,
        autoDetect: true
      };
      
      setSettings(defaultSettings);
    }
  };

  const formatExample = (format, type) => {
    const now = new Date();
    const locale = `${settings.language}-${settings.region}`;
    
    switch (type) {
      case 'date':
        return now.toLocaleDateString(locale);
      case 'time':
        return settings.timeFormat === '12h' 
          ? now.toLocaleTimeString(locale, { hour12: true })
          : now.toLocaleTimeString(locale, { hour12: false });
      case 'number':
        return (12345.67).toLocaleString(locale);
      default:
        return format;
    }
  };

  const selectedLanguage = languages.find(l => l.code === settings.language);
  const availableRegions = regions[settings.language] || [{ code: 'US', name: 'Default', flag: '🌐' }];
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="language-settings">
      {/* Language Selection */}
      <div className="settings-section">
        <h3>Language</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.autoDetect}
              onChange={(e) => handleSettingChange('autoDetect', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Auto-detect from browser</span>
          </label>
          <small className="setting-description">
            Automatically use your browser's language preference
          </small>
        </div>

        <div className="language-selector">
          <label>Select Language:</label>
          <div className="language-grid">
            {languages.map(language => (
              <label key={language.code} className="language-option">
                <input
                  type="radio"
                  name="language"
                  value={language.code}
                  checked={settings.language === language.code}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  disabled={settings.autoDetect}
                />
                <div className="language-content">
                  <span className="language-flag">{language.flag}</span>
                  <div className="language-info">
                    <div className="language-name">{language.name}</div>
                    <div className="language-native">{language.nativeName}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Region Selection */}
      <div className="settings-section">
        <h3>Region</h3>
        
        <div className="region-selector">
          <label>Select Region for {selectedLanguage?.name}:</label>
          <div className="region-options">
            {availableRegions.map(region => (
              <label key={region.code} className="region-option">
                <input
                  type="radio"
                  name="region"
                  value={region.code}
                  checked={settings.region === region.code}
                  onChange={(e) => handleSettingChange('region', e.target.value)}
                />
                <div className="region-content">
                  <span className="region-flag">{region.flag}</span>
                  <span className="region-name">{region.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Format Settings */}
      <div className="settings-section">
        <h3>Format Settings</h3>
        
        <div className="format-setting">
          <label>Date Format:</label>
          <select
            value={settings.dateFormat}
            onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
            className="format-select"
          >
            {dateFormats.map(format => (
              <option key={format.value} value={format.value}>
                {format.label} ({format.example})
              </option>
            ))}
          </select>
          <div className="format-preview">
            Preview: {formatExample(settings.dateFormat, 'date')}
          </div>
        </div>

        <div className="format-setting">
          <label>Time Format:</label>
          <div className="time-format-options">
            {timeFormats.map(format => (
              <label key={format.value} className="time-format-option">
                <input
                  type="radio"
                  name="timeFormat"
                  value={format.value}
                  checked={settings.timeFormat === format.value}
                  onChange={(e) => handleSettingChange('timeFormat', e.target.value)}
                />
                <div className="format-content">
                  <span className="format-name">{format.label}</span>
                  <span className="format-example">{format.example}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="format-preview">
            Preview: {formatExample(settings.timeFormat, 'time')}
          </div>
        </div>

        <div className="format-setting">
          <label>Number Format:</label>
          <select
            value={settings.numberFormat}
            onChange={(e) => handleSettingChange('numberFormat', e.target.value)}
            className="format-select"
          >
            <option value="en-US">US (12,345.67)</option>
            <option value="en-GB">UK (12,345.67)</option>
            <option value="de-DE">German (12.345,67)</option>
            <option value="fr-FR">French (12 345,67)</option>
            <option value="es-ES">Spanish (12.345,67)</option>
            <option value="it-IT">Italian (12.345,67)</option>
          </select>
          <div className="format-preview">
            Preview: {formatExample(settings.numberFormat, 'number')}
          </div>
        </div>
      </div>

      {/* Text Direction */}
      <div className="settings-section">
        <h3>Text Direction</h3>
        
        <div className="setting-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.rtlSupport}
              onChange={(e) => handleSettingChange('rtlSupport', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Right-to-left text support</span>
          </label>
          <small className="setting-description">
            Enable support for RTL languages like Arabic, Hebrew, etc.
          </small>
        </div>

        {settings.rtlSupport && (
          <div className="rtl-preview">
            <div className="rtl-demo" dir="rtl">
              <div className="demo-message">مرحبا! كيف حالك؟</div>
              <div className="demo-message">Hello! How are you?</div>
            </div>
          </div>
        )}
      </div>

      {/* Translation Status */}
      <div className="settings-section">
        <h3>Translation Status</h3>
        
        <div className="translation-status">
          <div className="status-item">
            <span className="status-language">{selectedLanguage?.nativeName}</span>
            <div className="status-bar">
              <div 
                className="status-progress" 
                style={{ width: `${selectedLanguage?.code === 'en' ? 100 : Math.floor(Math.random() * 40) + 60}%` }}
              ></div>
            </div>
            <span className="status-percentage">
              {selectedLanguage?.code === 'en' ? '100%' : `${Math.floor(Math.random() * 40) + 60}%`}
            </span>
          </div>
          
          <div className="translation-info">
            <p>
              {selectedLanguage?.code === 'en' 
                ? 'English is fully supported with all features available.'
                : 'Translation is in progress. Some features may not be fully translated yet.'
              }
            </p>
            <button className="btn-secondary">
              Help Translate
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="settings-section">
        <h3>Preview</h3>
        
        <div className="language-preview" dir={settings.rtlSupport ? 'rtl' : 'ltr'}>
          <div className="preview-header">
            <h4>Sample Interface</h4>
            <span className="preview-time">
              {formatExample(settings.timeFormat, 'time')}
            </span>
          </div>
          <div className="preview-content">
            <div className="preview-item">
              <span className="preview-label">Date:</span>
              <span className="preview-value">{formatExample(settings.dateFormat, 'date')}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Number:</span>
              <span className="preview-value">{formatExample(settings.numberFormat, 'number')}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Language:</span>
              <span className="preview-value">{selectedLanguage?.nativeName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="language-actions">
        <button 
          className="btn-secondary"
          onClick={handleReset}
          disabled={saving}
        >
          Reset to Browser Default
        </button>
        <button 
          className="btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save Language Settings'}
        </button>
      </div>
    </div>
  );
}
