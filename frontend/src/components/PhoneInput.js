import React, { useState } from 'react';

const countryCodes = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+7', country: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+46', country: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47', country: 'NO', flag: '🇳🇴', name: 'Norway' },
  { code: '+45', country: 'DK', flag: '🇩🇰', name: 'Denmark' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', country: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium' }
];

export default function PhoneInput({ onSubmit, loading }) {
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.includes(searchTerm)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      return;
    }

    // Remove any non-digit characters except +
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    const fullNumber = selectedCountry.code + cleanNumber;
    
    // Basic validation
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return;
    }

    onSubmit(fullNumber);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^\d\s\-\(\)]/g, '');
    setPhoneNumber(value);
  };

  const selectCountry = (country) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearchTerm('');
  };

  return (
    <form onSubmit={handleSubmit} className="phone-form">
      <div className="phone-input-container">
        <div className="country-selector">
          <button
            type="button"
            className="country-button"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="flag">{selectedCountry.flag}</span>
            <span className="code">{selectedCountry.code}</span>
            <span className="dropdown-arrow">▼</span>
          </button>

          {showDropdown && (
            <div className="country-dropdown">
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="country-search"
                />
              </div>
              <div className="country-list">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    className="country-option"
                    onClick={() => selectCountry(country)}
                  >
                    <span className="flag">{country.flag}</span>
                    <span className="name">{country.name}</span>
                    <span className="code">{country.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder="Phone number"
          className="phone-number-input"
          required
        />
      </div>

      <button
        type="submit"
        className="btn-primary full-width"
        disabled={loading || !phoneNumber.trim()}
      >
        {loading ? 'Sending...' : 'Send OTP'}
      </button>

      <div className="phone-example">
        <small className="muted">
          Example: {selectedCountry.code} 1234567890
        </small>
      </div>
    </form>
  );
}
