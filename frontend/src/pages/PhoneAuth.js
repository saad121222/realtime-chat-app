import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import OTPInput from '../components/OTPInput';
import PhoneInput from '../components/PhoneInput';

export default function PhoneAuth() {
  const { loginWithOTP, loading } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'name'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (otpExpiry && timeLeft > 0) {
      const timer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiry - Date.now()) / 1000));
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          setCanResend(true);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [otpExpiry, timeLeft]);

  const handleSendOTP = async (phone) => {
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      });

      const data = await response.json();

      if (response.ok) {
        setPhoneNumber(phone);
        setOtpExpiry(new Date(data.expiresAt).getTime());
        setTimeLeft(300); // 5 minutes
        setCanResend(false);
        setStep('otp');
        toast.success('OTP sent successfully!');
      } else {
        toast.error(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleVerifyOTP = async (otpCode, userName = '') => {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber, 
          otp: otpCode, 
          name: userName,
          deviceInfo 
        })
      });

      const data = await response.json();

      if (response.ok) {
        const result = await loginWithOTP(data.accessToken, data.user);
        if (result.ok) {
          toast.success(data.message);
          navigate('/');
        } else {
          toast.error(result.message);
        }
      } else {
        if (data.message.includes('Name is required')) {
          setIsNewUser(true);
          setStep('name');
        } else {
          toast.error(data.message || 'Invalid OTP');
        }
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (response.ok) {
        setOtpExpiry(new Date(data.expiresAt).getTime());
        setTimeLeft(300);
        setCanResend(false);
        setOtp('');
        toast.success('OTP resent successfully!');
      } else {
        toast.error(data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome to WhatsApp Clone</h1>
          <p className="muted">
            {step === 'phone' && 'Enter your phone number to get started'}
            {step === 'otp' && 'Enter the verification code'}
            {step === 'name' && 'Complete your profile'}
          </p>
        </div>

        {step === 'phone' && (
          <PhoneInput 
            onSubmit={handleSendOTP}
            loading={loading}
          />
        )}

        {step === 'otp' && (
          <div className="otp-step">
            <div className="phone-display">
              <span className="muted">Code sent to</span>
              <strong>{phoneNumber}</strong>
              <button 
                className="link-button"
                onClick={() => setStep('phone')}
              >
                Change number
              </button>
            </div>

            <OTPInput
              value={otp}
              onChange={setOtp}
              onComplete={(code) => handleVerifyOTP(code, name)}
              loading={loading}
            />

            <div className="otp-footer">
              {timeLeft > 0 ? (
                <p className="muted">
                  Resend code in {formatTime(timeLeft)}
                </p>
              ) : (
                <button
                  className="link-button"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="name-step">
            <div className="form-group">
              <label>Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="form-input"
                maxLength={50}
                required
              />
              <small className="muted">
                This name will be visible to your contacts
              </small>
            </div>

            <button
              className="btn-primary full-width"
              onClick={() => handleVerifyOTP(otp, name)}
              disabled={loading || !name.trim()}
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>

            <button
              className="link-button"
              onClick={() => setStep('otp')}
            >
              Back to OTP
            </button>
          </div>
        )}

        <div className="auth-footer">
          <p className="muted small">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
