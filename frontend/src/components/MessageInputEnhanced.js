import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from './EmojiPicker';
import socketService from '../services/socketEnhanced';

export default function MessageInputEnhanced({ 
  onSendMessage, 
  onSendFile, 
  chatId, 
  disabled = false,
  placeholder = "Type a message..." 
}) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingTime = useRef(0);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Handle typing indicators
  useEffect(() => {
    if (!chatId) return;

    const handleTyping = () => {
      const now = Date.now();
      lastTypingTime.current = now;

      if (!isTyping) {
        setIsTyping(true);
        socketService.startTyping(chatId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        if (Date.now() - lastTypingTime.current >= 1000) {
          setIsTyping(false);
          socketService.stopTyping(chatId);
        }
      }, 1000);
    };

    const handleStopTyping = () => {
      if (isTyping) {
        setIsTyping(false);
        socketService.stopTyping(chatId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };

    return () => {
      handleStopTyping();
    };
  }, [chatId, isTyping]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Trigger typing indicator if user is typing
    if (value.trim() && chatId) {
      const now = Date.now();
      lastTypingTime.current = now;

      if (!isTyping) {
        setIsTyping(true);
        socketService.startTyping(chatId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout
      typingTimeoutRef.current = setTimeout(() => {
        if (Date.now() - lastTypingTime.current >= 1000) {
          setIsTyping(false);
          socketService.stopTyping(chatId);
        }
      }, 1000);
    } else if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(chatId);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(chatId);
    }

    onSendMessage(trimmedMessage);
    setMessage('');
    
    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onSendFile) {
      files.forEach(file => onSendFile(file));
    }
    // Reset file input
    e.target.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && onSendFile) {
          onSendFile(file);
        }
        break;
      }
    }
  };

  return (
    <div className="message-input-container">
      <div className="message-input">
        {/* Emoji Picker */}
        <div className="emoji-button-container">
          <button
            type="button"
            className="icon emoji-button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={disabled}
            title="Add emoji"
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker 
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}
        </div>

        {/* File Upload */}
        <button
          type="button"
          className="icon file-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach file"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Message Input */}
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder={disabled ? "Cannot send messages" : placeholder}
            disabled={disabled}
            className="message-textarea"
            rows={1}
            maxLength={4000}
          />
          {message.length > 3800 && (
            <div className="character-count">
              {4000 - message.length} characters remaining
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          className={`send-button ${message.trim() ? 'active' : ''}`}
          onClick={handleSendMessage}
          disabled={disabled || !message.trim()}
          title="Send message"
        >
          {message.trim() ? '➤' : '🎤'}
        </button>
      </div>

      {/* Typing Indicator (for current user) */}
      {isTyping && (
        <div className="typing-status">
          <small>Typing...</small>
        </div>
      )}
    </div>
  );
}
