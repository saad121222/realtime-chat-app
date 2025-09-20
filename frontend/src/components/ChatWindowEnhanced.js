import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import MessageBubbleEnhanced from './MessageBubbleEnhanced';
import MessageInputEnhanced from './MessageInputEnhanced';
import TypingIndicatorEnhanced from './TypingIndicatorEnhanced';
import socketService from '../services/socketEnhanced';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ChatWindowEnhanced({ 
  chat, 
  onBack,
  onChatUpdate 
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMessageRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto' 
      });
    }
  }, []);

  // Load messages
  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    if (!chat?._id) return;

    setLoading(true);
    try {
      const response = await api.get(`/messages/${chat._id}?page=${pageNum}&limit=50`);
      const newMessages = response.data.messages || [];
      
      if (append) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
        // Scroll to bottom for new chat or first load
        setTimeout(() => scrollToBottom(false), 100);
      }
      
      setHasMoreMessages(response.data.pagination?.hasMore || false);
      
      // Mark messages as delivered
      const undeliveredMessages = newMessages.filter(msg => 
        msg.sender._id !== user?.id && 
        !msg.deliveredTo?.some(d => d.user === user?.id)
      );
      
      undeliveredMessages.forEach(msg => {
        socketService.markMessageDelivered(msg._id, chat._id);
      });
      
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [chat?._id, user?.id, scrollToBottom]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loading) return;
    
    const nextPage = page + 1;
    await loadMessages(nextPage, true);
    setPage(nextPage);
  }, [hasMoreMessages, loading, page, loadMessages]);

  // Initialize chat
  useEffect(() => {
    if (chat?._id) {
      setMessages([]);
      setPage(1);
      setTypingUsers([]);
      setReplyingTo(null);
      setEditingMessage(null);
      
      // Join chat room
      socketService.joinChat(chat._id);
      
      // Load initial messages
      loadMessages(1, false);
      
      // Mark chat as read
      markChatAsRead();
    }

    return () => {
      if (chat?._id) {
        socketService.leaveChat(chat._id);
      }
    };
  }, [chat?._id, loadMessages]);

  // Socket event handlers
  useEffect(() => {
    const handleNewMessage = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => [...prev, data.message]);
        
        // Auto-scroll if user is near bottom
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            
            if (isNearBottom || data.message.sender._id === user?.id) {
              scrollToBottom();
            }
          }
        }, 100);
        
        // Mark as delivered if not own message
        if (data.message.sender._id !== user?.id) {
          socketService.markMessageDelivered(data.message._id, chat._id);
        }
      }
    };

    const handleMessageSent = (data) => {
      // Update temporary message with real message data
      setMessages(prev => prev.map(msg => 
        msg.tempId === data.tempId ? data.message : msg
      ));
    };

    const handleMessageError = (data) => {
      // Remove failed message or mark as failed
      setMessages(prev => prev.map(msg => 
        msg.tempId === data.tempId 
          ? { ...msg, status: 'failed', error: data.error }
          : msg
      ));
      toast.error(data.error || 'Failed to send message');
    };

    const handleMessageStatusUpdate = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, status: data.status }
            : msg
        ));
      }
    };

    const handleUserTyping = (data) => {
      if (data.chatId === chat?._id && data.userId !== user?.id) {
        setTypingUsers(prev => {
          const existing = prev.find(u => u._id === data.userId);
          if (!existing) {
            return [...prev, { _id: data.userId, ...data.user }];
          }
          return prev;
        });
      }
    };

    const handleUserStopTyping = (data) => {
      if (data.chatId === chat?._id) {
        setTypingUsers(prev => prev.filter(u => u._id !== data.userId));
      }
    };

    const handleMessageReaction = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? {
                ...msg, 
                reactions: [...(msg.reactions || []), data.reaction]
              }
            : msg
        ));
      }
    };

    const handleMessageReactionRemoved = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? {
                ...msg, 
                reactions: (msg.reactions || []).filter(r => r.user._id !== data.userId)
              }
            : msg
        ));
      }
    };

    const handleMessageEdited = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, content: data.content, isEdited: true, editedAt: data.editedAt }
            : msg
        ));
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    };

    // Register event listeners
    socketService.on('new_message', handleNewMessage);
    socketService.on('message_sent', handleMessageSent);
    socketService.on('message_error', handleMessageError);
    socketService.on('message_status_update', handleMessageStatusUpdate);
    socketService.on('user_typing', handleUserTyping);
    socketService.on('user_stop_typing', handleUserStopTyping);
    socketService.on('message_reaction', handleMessageReaction);
    socketService.on('message_reaction_removed', handleMessageReactionRemoved);
    socketService.on('message_edited', handleMessageEdited);
    socketService.on('message_deleted', handleMessageDeleted);

    return () => {
      // Cleanup event listeners
      socketService.off('new_message', handleNewMessage);
      socketService.off('message_sent', handleMessageSent);
      socketService.off('message_error', handleMessageError);
      socketService.off('message_status_update', handleMessageStatusUpdate);
      socketService.off('user_typing', handleUserTyping);
      socketService.off('user_stop_typing', handleUserStopTyping);
      socketService.off('message_reaction', handleMessageReaction);
      socketService.off('message_reaction_removed', handleMessageReactionRemoved);
      socketService.off('message_edited', handleMessageEdited);
      socketService.off('message_deleted', handleMessageDeleted);
    };
  }, [chat?._id, user?.id, scrollToBottom]);

  // Mark chat as read when messages are visible
  const markChatAsRead = useCallback(async () => {
    if (!chat?._id) return;
    
    try {
      await api.post(`/messages/${chat._id}/mark-read`);
      
      // Mark visible messages as read
      const unreadMessages = messages.filter(msg => 
        msg.sender._id !== user?.id && 
        !msg.readBy?.some(r => r.user === user?.id)
      );
      
      unreadMessages.forEach(msg => {
        socketService.markMessageRead(msg._id, chat._id);
      });
      
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [chat?._id, messages, user?.id]);

  // Mark messages as read when they come into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            const message = messages.find(m => m._id === messageId);
            
            if (message && message.sender._id !== user?.id) {
              socketService.markMessageRead(messageId, chat._id);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe message elements
    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, user?.id, chat?._id]);

  // Handle scroll for pagination
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMoreMessages && !loading) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loading, loadMoreMessages]);

  // Send text message
  const handleSendMessage = useCallback((content) => {
    if (!content.trim() || !chat?._id) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      tempId,
      content: content.trim(),
      sender: {
        _id: user?.id,
        name: user?.name,
        avatar: user?.avatar
      },
      chat: chat._id,
      messageType: 'text',
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyTo: replyingTo?._id || null,
      reactions: []
    };

    // Add temporary message to UI
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    // Send via socket
    socketService.sendMessage({
      content: content.trim(),
      chatId: chat._id,
      messageType: 'text',
      replyTo: replyingTo?._id || null,
      tempId
    });

    // Clear reply
    setReplyingTo(null);
  }, [chat?._id, user, replyingTo, scrollToBottom]);

  // Send file message
  const handleSendFile = useCallback(async (file) => {
    if (!file || !chat?._id) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chat._id);
      
      if (replyingTo) {
        formData.append('replyTo', replyingTo._id);
      }

      const response = await api.post('/messages/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Clear reply
      setReplyingTo(null);
      
      toast.success('File sent successfully');
    } catch (error) {
      console.error('Failed to send file:', error);
      toast.error('Failed to send file');
    }
  }, [chat?._id, replyingTo]);

  // Message actions
  const handleReaction = useCallback((messageId, emoji) => {
    if (emoji) {
      socketService.addReaction(messageId, emoji, chat._id);
    } else {
      socketService.removeReaction(messageId, chat._id);
    }
  }, [chat?._id]);

  const handleReply = useCallback((message) => {
    setReplyingTo(message);
  }, []);

  const handleEdit = useCallback((message) => {
    setEditingMessage(message);
  }, []);

  const handleDelete = useCallback(async (message) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await api.delete(`/messages/${message._id}`);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  }, []);

  if (!chat) {
    return (
      <div className="chat-window-empty">
        <div className="empty-state">
          <h3>Select a chat to start messaging</h3>
          <p>Choose from your existing conversations or start a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <button className="back-button" onClick={onBack}>←</button>
        <div className="chat-avatar">
          {chat.avatar ? (
            <img src={chat.avatar} alt={chat.name} />
          ) : (
            <span>{(chat.name || '?').slice(0, 1).toUpperCase()}</span>
          )}
          {chat.isOnline && <div className="online-dot"></div>}
        </div>
        <div className="chat-info">
          <div className="chat-name">{chat.name}</div>
          <div className="chat-status">
            {chat.isOnline ? 'Online' : `Last seen ${chat.lastSeen ? new Date(chat.lastSeen).toLocaleString() : 'recently'}`}
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-button" title="Call">📞</button>
          <button className="icon-button" title="Video call">📹</button>
          <button className="icon-button" title="More">⋮</button>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loading && page === 1 && (
          <div className="loading-messages">Loading messages...</div>
        )}
        
        {hasMoreMessages && (
          <div className="load-more">
            <button onClick={loadMoreMessages} disabled={loading}>
              {loading ? 'Loading...' : 'Load more messages'}
            </button>
          </div>
        )}

        <div className="messages">
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showSender = !prevMessage || 
              prevMessage.sender._id !== message.sender._id ||
              (new Date(message.createdAt) - new Date(prevMessage.createdAt)) > 300000; // 5 minutes

            return (
              <div key={message._id || message.tempId} data-message-id={message._id}>
                <MessageBubbleEnhanced
                  message={message}
                  showSender={showSender && chat.chatType === 'group'}
                  onReaction={handleReaction}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}
          
          {/* Typing Indicator */}
          <TypingIndicatorEnhanced 
            typingUsers={typingUsers}
            chatType={chat.chatType}
          />
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-content">
            <div className="reply-sender">{replyingTo.sender?.name}</div>
            <div className="reply-text">
              {replyingTo.messageType === 'text' 
                ? replyingTo.content 
                : `${replyingTo.messageType} message`
              }
            </div>
          </div>
          <button 
            className="reply-close"
            onClick={() => setReplyingTo(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Message Input */}
      <MessageInputEnhanced
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        chatId={chat._id}
        disabled={!chat.isParticipant}
        placeholder={
          replyingTo 
            ? `Reply to ${replyingTo.sender?.name}...`
            : "Type a message..."
        }
      />
    </div>
  );
}
