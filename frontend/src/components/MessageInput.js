import React, { useRef, useState, useEffect } from 'react';
import { getSocket } from '../services/socket';

export default function MessageInput({ onSend, onSendFile, chatId }) {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fileRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    handleStopTyping();
  };

  const handleStartTyping = () => {
    const socket = getSocket();
    if (!socket || !chatId || isTyping) return;
    
    setIsTyping(true);
    socket.emit('typing_start', { chatId });
  };

  const handleStopTyping = () => {
    const socket = getSocket();
    if (!socket || !chatId || !isTyping) return;
    
    setIsTyping(false);
    socket.emit('typing_stop', { chatId });
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    
    if (e.target.value.trim() && !isTyping) {
      handleStartTyping();
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      handleStopTyping();
    };
  }, [chatId]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && onSendFile) onSendFile(f);
    e.target.value = '';
  };

  return (
    <div className="message-input">
      <button className="icon" onClick={handlePickFile} title="Attach">📎</button>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
      <textarea value={text} onChange={handleTextChange} onKeyDown={onKeyDown} placeholder="Type a message" />
      <button className="send" onClick={handleSend}>Send</button>
    </div>
  );
}
