import React from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function ChatList({ chats, activeChatId, onSelect }) {
  return (
    <div className="chat-list">
      {chats.map(chat => {
        const otherParticipant = chat.isGroupChat ? null : chat.participants?.find(p => p._id !== chat.admin?._id);
        const title = chat.isGroupChat ? chat.name : (otherParticipant?.name || 'Chat');
        const isOnline = chat.isGroupChat ? false : otherParticipant?.isOnline;
        const lastMsg = chat.lastMessage?.messageType === 'text' ? chat.lastMessage?.content : chat.lastMessage ? `📎 ${chat.lastMessage.messageType}` : '';
        
        return (
          <button key={chat._id} className={`chat-list-item ${activeChatId===chat._id?'active':''}`} onClick={()=>onSelect(chat)}>
            <div className="chat-avatar">
              {otherParticipant?.avatar ? (
                <img src={otherParticipant.avatar} alt={title} />
              ) : (
                <span>{(title||'?').slice(0,2).toUpperCase()}</span>
              )}
              {isOnline && <div className="online-dot"></div>}
            </div>
            <div className="chat-meta">
              <div className="chat-top">
                <span className="chat-title">{title}</span>
                <span className="chat-time">{chat.updatedAt ? formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true }) : ''}</span>
              </div>
              <div className="chat-bottom">
                <span className="chat-last">{lastMsg}</span>
                {chat.unreadCount>0 && <span className="badge">{chat.unreadCount}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
