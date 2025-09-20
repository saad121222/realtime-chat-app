import React from 'react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function MessageBubble({ message }) {
  const { user } = useAuth();
  const mine = message.sender?._id === user?.id;

  const renderContent = () => {
    if (message.messageType === 'image') return <img className="message-image" src={message.fileUrl} alt={message.fileName || 'image'} />;
    if (message.messageType === 'file') return <a href={message.fileUrl} target="_blank" rel="noreferrer">{message.fileName || 'Download file'}</a>;
    if (message.messageType === 'audio') return <audio controls src={message.fileUrl} />;
    if (message.messageType === 'video') return <video controls className="message-video" src={message.fileUrl} />;
    return <span>{message.content}</span>;
  };

  const getStatusIcon = () => {
    if (!mine) return '';
    switch (message.status) {
      case 'read': return <span className="status read">✔✔</span>;
      case 'delivered': return <span className="status delivered">✔✔</span>;
      default: return <span className="status sent">✔</span>;
    }
  };

  return (
    <div className={`message-row ${mine ? 'mine' : ''}`}>
      {!mine && (
        <div className="sender-avatar">
          {message.sender?.avatar ? (
            <img src={message.sender.avatar} alt={message.sender.name} />
          ) : (
            <span>{(message.sender?.name || '?').slice(0, 1).toUpperCase()}</span>
          )}
        </div>
      )}
      <div className="bubble">
        {!mine && <div className="sender-name">{message.sender?.name}</div>}
        {renderContent()}
        <div className="meta">
          <span className="time">{message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}</span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
