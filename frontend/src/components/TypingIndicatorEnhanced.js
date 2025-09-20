import React, { useState, useEffect } from 'react';

export default function TypingIndicatorEnhanced({ typingUsers = [], chatType = 'direct' }) {
  const [visibleUsers, setVisibleUsers] = useState([]);

  useEffect(() => {
    // Filter out any invalid typing users and limit display
    const validUsers = typingUsers.filter(user => user && user.name);
    setVisibleUsers(validUsers.slice(0, 3)); // Show max 3 users
  }, [typingUsers]);

  if (!visibleUsers || visibleUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    const count = visibleUsers.length;
    
    if (count === 1) {
      return chatType === 'group' 
        ? `${visibleUsers[0].name} is typing...`
        : 'typing...';
    } else if (count === 2) {
      return chatType === 'group'
        ? `${visibleUsers[0].name} and ${visibleUsers[1].name} are typing...`
        : '2 people are typing...';
    } else {
      return chatType === 'group'
        ? `${visibleUsers[0].name} and ${count - 1} others are typing...`
        : `${count} people are typing...`;
    }
  };

  const renderTypingDots = () => (
    <div className="typing-dots">
      <span className="dot dot-1"></span>
      <span className="dot dot-2"></span>
      <span className="dot dot-3"></span>
    </div>
  );

  const renderUserAvatars = () => {
    if (chatType !== 'group' || visibleUsers.length === 0) {
      return null;
    }

    return (
      <div className="typing-avatars">
        {visibleUsers.slice(0, 2).map((user, index) => (
          <div key={user._id || index} className="typing-avatar">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <span>{user.name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="typing-indicator">
      <div className="typing-content">
        {renderUserAvatars()}
        <div className="typing-info">
          {renderTypingDots()}
          <span className="typing-text">{getTypingText()}</span>
        </div>
      </div>
    </div>
  );
}
