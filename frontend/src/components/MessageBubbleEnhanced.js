import React, { useState, useRef, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '../context/AuthContextEnhanced';
import socketService from '../services/socketEnhanced';

export default function MessageBubbleEnhanced({ 
  message, 
  showSender = false, 
  showTimestamp = false,
  onReaction,
  onEdit,
  onDelete,
  onReply 
}) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const messageRef = useRef(null);
  const actionsRef = useRef(null);

  const mine = message.sender?._id === user?.id;

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActions]);

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  const getStatusIcon = () => {
    if (!mine) return null;
    
    switch (message.status) {
      case 'sending':
        return <span className="status sending">⏳</span>;
      case 'sent':
        return <span className="status sent">✓</span>;
      case 'delivered':
        return <span className="status delivered">✓✓</span>;
      case 'read':
        return <span className="status read">✓✓</span>;
      case 'failed':
        return <span className="status failed">❌</span>;
      default:
        return <span className="status sent">✓</span>;
    }
  };

  const renderContent = () => {
    switch (message.messageType) {
      case 'image':
        return (
          <div className="message-image-container">
            <img 
              className="message-image" 
              src={message.fileUrl} 
              alt={message.fileName || 'image'}
              loading="lazy"
            />
            {message.content && (
              <div className="image-caption">{message.content}</div>
            )}
          </div>
        );
      
      case 'video':
        return (
          <div className="message-video-container">
            <video 
              className="message-video" 
              src={message.fileUrl} 
              controls
              preload="metadata"
            />
            {message.content && (
              <div className="video-caption">{message.content}</div>
            )}
          </div>
        );
      
      case 'audio':
        return (
          <div className="message-audio-container">
            <audio 
              className="message-audio" 
              src={message.fileUrl} 
              controls
            />
            <div className="audio-info">
              <span className="audio-name">{message.fileName || 'Audio'}</span>
              {message.fileSize && (
                <span className="audio-size">
                  {(message.fileSize / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="message-document">
            <div className="document-icon">📄</div>
            <div className="document-info">
              <div className="document-name">{message.fileName || 'Document'}</div>
              {message.fileSize && (
                <div className="document-size">
                  {(message.fileSize / 1024 / 1024).toFixed(1)} MB
                </div>
              )}
            </div>
            <a 
              href={message.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="document-download"
            >
              ⬇️
            </a>
          </div>
        );
      
      default:
        return (
          <div className="message-text">
            {message.content}
            {message.isEdited && (
              <span className="edited-indicator" title={`Edited ${formatMessageTime(message.editedAt)}`}>
                (edited)
              </span>
            )}
          </div>
        );
    }
  };

  const handleReactionClick = (emoji) => {
    if (onReaction) {
      onReaction(message._id, emoji);
    }
    socketService.addReaction(message._id, emoji, message.chat);
    setShowReactions(false);
  };

  const handleRemoveReaction = () => {
    if (onReaction) {
      onReaction(message._id, null);
    }
    socketService.removeReaction(message._id, message.chat);
  };

  const getUserReaction = () => {
    return message.reactions?.find(r => r.user._id === user?.id);
  };

  const getReactionCounts = () => {
    const counts = {};
    message.reactions?.forEach(reaction => {
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
    });
    return counts;
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  return (
    <div className={`message-row ${mine ? 'mine' : ''}`} ref={messageRef}>
      {/* Sender Avatar (for group chats) */}
      {!mine && showSender && (
        <div className="sender-avatar">
          {message.sender?.avatar ? (
            <img src={message.sender.avatar} alt={message.sender.name} />
          ) : (
            <span>{(message.sender?.name || '?').slice(0, 1).toUpperCase()}</span>
          )}
        </div>
      )}

      <div className="message-bubble-container">
        {/* Reply indicator */}
        {message.replyTo && (
          <div className="reply-indicator">
            <div className="reply-line"></div>
            <div className="reply-content">
              <div className="reply-sender">{message.replyTo.sender?.name}</div>
              <div className="reply-text">
                {message.replyTo.messageType === 'text' 
                  ? message.replyTo.content 
                  : `${message.replyTo.messageType} message`
                }
              </div>
            </div>
          </div>
        )}

        {/* Message Bubble */}
        <div 
          className="bubble"
          onDoubleClick={() => setShowReactions(!showReactions)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowActions(!showActions);
          }}
        >
          {/* Sender name (for group chats) */}
          {!mine && showSender && (
            <div className="sender-name">{message.sender?.name}</div>
          )}

          {/* Message content */}
          {renderContent()}

          {/* Message metadata */}
          <div className="message-meta">
            <span className="message-time">
              {formatMessageTime(message.createdAt)}
            </span>
            {getStatusIcon()}
          </div>

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="message-reactions">
              {Object.entries(getReactionCounts()).map(([emoji, count]) => (
                <button
                  key={emoji}
                  className={`reaction-bubble ${
                    message.reactions.some(r => r.emoji === emoji && r.user._id === user?.id) 
                      ? 'my-reaction' 
                      : ''
                  }`}
                  onClick={() => {
                    const hasMyReaction = message.reactions.some(
                      r => r.emoji === emoji && r.user._id === user?.id
                    );
                    if (hasMyReaction) {
                      handleRemoveReaction();
                    } else {
                      handleReactionClick(emoji);
                    }
                  }}
                  title={
                    message.reactions
                      .filter(r => r.emoji === emoji)
                      .map(r => r.user.name)
                      .join(', ')
                  }
                >
                  {emoji} {count > 1 && count}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Reactions */}
        {showReactions && (
          <div className="quick-reactions">
            {quickReactions.map(emoji => (
              <button
                key={emoji}
                className="quick-reaction-btn"
                onClick={() => handleReactionClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Message Actions */}
        {showActions && (
          <div className="message-actions" ref={actionsRef}>
            <button onClick={() => onReply?.(message)}>Reply</button>
            {mine && message.messageType === 'text' && (
              <button onClick={() => onEdit?.(message)}>Edit</button>
            )}
            <button onClick={() => setShowReactions(!showReactions)}>React</button>
            {mine && (
              <button 
                onClick={() => onDelete?.(message)}
                className="delete-action"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timestamp (if shown separately) */}
      {showTimestamp && (
        <div className="message-timestamp">
          {formatMessageTime(message.createdAt)}
        </div>
      )}
    </div>
  );
}
