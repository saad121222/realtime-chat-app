import React from 'react';

export default function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">💬</div>
        <h2>Welcome to WhatsApp Clone</h2>
        <p>Send and receive messages without keeping your phone online.</p>
        <div className="welcome-features">
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>End-to-end encrypted</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Real-time messaging</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📎</span>
            <span>File sharing</span>
          </div>
          <div className="feature">
            <span className="feature-icon">👥</span>
            <span>Group chats</span>
          </div>
        </div>
        <div className="welcome-tip">
          <strong>💡 Tip:</strong> Click "New Chat" to start messaging or create a second account in another browser tab to test real-time features!
        </div>
      </div>
    </div>
  );
}
