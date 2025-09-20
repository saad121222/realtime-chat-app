import React, { useState, useRef, useEffect } from 'react';

export default function OTPInput({ value, onChange, onComplete, loading, length = 6 }) {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (value) {
      const otpArray = value.split('').slice(0, length);
      while (otpArray.length < length) {
        otpArray.push('');
      }
      setOtp(otpArray);
    }
  }, [value, length]);

  useEffect(() => {
    const otpString = otp.join('');
    onChange(otpString);
    
    if (otpString.length === length && !loading) {
      onComplete(otpString);
    }
  }, [otp, onChange, onComplete, length, loading]);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Focus next input
    if (element.value && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      
      if (otp[index]) {
        // Clear current input
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move to previous input and clear it
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain');
    const pastedNumbers = pastedData.replace(/\D/g, '').slice(0, length);
    
    if (pastedNumbers) {
      const newOtp = new Array(length).fill('');
      for (let i = 0; i < pastedNumbers.length; i++) {
        newOtp[i] = pastedNumbers[i];
      }
      setOtp(newOtp);
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(pastedNumbers.length, length - 1);
      inputRefs.current[nextIndex].focus();
    }
  };

  const handleFocus = (index) => {
    // Select all text when focusing
    inputRefs.current[index].select();
  };

  return (
    <div className="otp-container">
      <div className="otp-inputs">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => handleFocus(index)}
            onPaste={handlePaste}
            className={`otp-input ${digit ? 'filled' : ''} ${loading ? 'loading' : ''}`}
            disabled={loading}
            autoComplete="one-time-code"
          />
        ))}
      </div>
      
      {loading && (
        <div className="otp-loading">
          <div className="spinner"></div>
          <span>Verifying...</span>
        </div>
      )}
      
      <div className="otp-help">
        <small className="muted">
          Enter the 6-digit code sent to your phone
        </small>
      </div>
    </div>
  );
}
