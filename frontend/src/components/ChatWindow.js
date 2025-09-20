import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ chat, messages, loading, typingUsers, onSendText, onSendFile }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const otherParticipant = chat.isGroupChat ? null : chat.participants?.find(p => p._id !== chat.admin?._id);
  const title = chat.isGroupChat ? chat.name : (otherParticipant?.name || 'Chat');
  const isOnline = chat.isGroupChat ? false : otherParticipant?.isOnline;
  const lastSeen = otherParticipant?.lastSeen;

  const getStatusText = () => {
    if (chat.isGroupChat) return `${chat.participants?.length || 0} participants`;
    if (isOnline) return 'online';
    if (lastSeen) return `last seen ${new Date(lastSeen).toLocaleString()}`;
    return 'offline';
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-title">{title}</div>
          <div className="chat-header-status">{getStatusText()}</div>
        </div>
      </div>
      <div className="messages" id="messages">
        {loading && <div className="muted small p-2">Loading...</div>}
        {messages.map(m => <MessageBubble key={m._id} message={m} />)}
        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={onSendText} onSendFile={onSendFile} chatId={chat._id} />
    </div>
  );
}
