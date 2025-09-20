import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContextEnhanced';
import { MemoizedVirtualizedMessageList } from './VirtualizedMessageList';
import MessageInputEnhanced from './MessageInputEnhanced';
import TypingIndicatorEnhanced from './TypingIndicatorEnhanced';
import GroupInfoModal from './GroupInfoModal';
import { LazyImage } from './LazyImage';
import { useMemoryCleanup } from '../utils/memoryManager';
import { messageCache } from '../services/cacheService';
import socketService from '../services/socketEnhanced';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ChatWindowResponsive({ 
  chat, 
  onBack,
  onChatUpdate,
  showBackButton = false
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [containerHeight, setContainerHeight] = useState(600);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastScrollTop = useRef(0);
  const isAutoScrolling = useRef(false);
  const { registerCleanup } = useMemoryCleanup([chat?._id]);

  // Smooth scroll to bottom with options
  const scrollToBottom = useCallback((smooth = true, force = false) => {
    if (!messagesEndRef.current || (!force && isAutoScrolling.current)) return;
    
    isAutoScrolling.current = true;
    messagesEndRef.current.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end'
    });
    
    setTimeout(() => {
      isAutoScrolling.current = false;
      setShowScrollButton(false);
    }, smooth ? 500 : 100);
  }, []);

  // Check if user is near bottom of messages
  const isNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isAutoScrolling.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    // Show/hide scroll to bottom button
    setShowScrollButton(!isAtBottom && messages.length > 0);
    
    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMoreMessages && !loading) {
      loadMoreMessages();
    }
    
    lastScrollTop.current = scrollTop;
  }, [hasMoreMessages, loading, messages.length]);

  // Throttled scroll handler
  useEffect(() => {
    let timeoutId;
    const throttledScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', throttledScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', throttledScroll);
        clearTimeout(timeoutId);
      };
    }
  }, [handleScroll]);

  // Load messages from API with caching
  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    if (loading || !chat?._id) return;

    // Try cache first
    const cacheKey = `${chat._id}-${pageNum}`;
    const cachedMessages = await messageCache.getMessages(chat._id, pageNum);
    
    if (cachedMessages && !append) {
      setMessages(cachedMessages);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/chats/${chat._id}/messages`, {
        params: { page: pageNum, limit: 50 }
      });

      const newMessages = response.data.messages || [];
      
      // Cache the messages
      await messageCache.setMessages(chat._id, pageNum, newMessages);
      
      if (append) {
        // Preserve scroll position when loading older messages
        const container = messagesContainerRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;
        
        setMessages(prev => [...newMessages, ...prev]);
        
        // Restore scroll position
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0);
      } else {
        setMessages(newMessages);
        // Scroll to bottom for new chat
        setTimeout(() => scrollToBottom(false, true), 100);
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

  // Calculate container height
  useEffect(() => {
    const calculateHeight = () => {
      const header = document.querySelector('.chat-header-responsive');
      const input = document.querySelector('.message-input-enhanced');
      const headerHeight = header?.offsetHeight || 60;
      const inputHeight = input?.offsetHeight || 80;
      const windowHeight = window.innerHeight;
      
      setContainerHeight(windowHeight - headerHeight - inputHeight - 20); // 20px padding
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
    registerCleanup(() => {
      window.removeEventListener('resize', calculateHeight);
    });
  }, [registerCleanup]);

  // Initialize chat and load messages
  useEffect(() => {
    if (chat?._id) {
      setMessages([]);
      setPage(1);
      setHasMoreMessages(true);
      setTypingUsers([]);
      setReplyingTo(null);
      loadMessages(1);
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
        
        // Auto-scroll if user is near bottom or it's their own message
        setTimeout(() => {
          if (isNearBottom() || data.message.sender._id === user?.id) {
            scrollToBottom(true);
          } else {
            setShowScrollButton(true);
          }
        }, 100);
        
        // Mark as delivered if not own message
        if (data.message.sender._id !== user?.id) {
          socketService.markMessageDelivered(data.message._id, chat._id);
        }
      }
    };

    const handleMessageSent = (data) => {
      setMessages(prev => prev.map(msg => 
        msg.tempId === data.tempId ? data.message : msg
      ));
    };

    const handleMessageError = (data) => {
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
  }, [chat?._id, user?.id, isNearBottom, scrollToBottom]);

  // Mark chat as read
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
    
    // Auto-scroll to show new message
    setTimeout(() => scrollToBottom(true), 100);

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
    // Implementation for message editing
    console.log('Edit message:', message);
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
    return null;
  }

  return (
    <div className="chat-window-responsive">
      {/* Chat Header */}
      <div className="chat-header-responsive">
        {showBackButton && (
          <button className="back-button" onClick={onBack}>
            ←
          </button>
        )}
        
        <div className="chat-avatar">
          <LazyImage
            src={chat.avatar}
            alt={chat.name}
            width={40}
            height={40}
            className="avatar-image"
            fallback={
              <div className="avatar-fallback">
                <span>{(chat.name || '?').slice(0, 1).toUpperCase()}</span>
              </div>
            }
          />
          {chat.isOnline && <div className="online-dot"></div>}
        </div>
        
        <div 
          className="chat-info"
          onClick={() => chat.chatType === 'group' ? setShowGroupInfo(true) : null}
          style={{ cursor: chat.chatType === 'group' ? 'pointer' : 'default' }}
        >
          <div className="chat-name">{chat.name}</div>
          <div className="chat-status">
            {typingUsers.length > 0 ? (
              <span className="typing-status">
                {typingUsers.length === 1 
                  ? `${typingUsers[0].name} is typing...`
                  : `${typingUsers.length} people are typing...`
                }
              </span>
            ) : chat.chatType === 'group' ? (
              <span className="group-status">
                {chat.participants?.length || 0} participants
              </span>
            ) : chat.isOnline ? (
              <span className="online-status">Online</span>
            ) : (
              <span className="offline-status">
                Last seen {chat.lastSeen ? new Date(chat.lastSeen).toLocaleString() : 'recently'}
              </span>
            )}
          </div>
        </div>
        
        <div className="chat-actions">
          <button className="action-button" title="Search">🔍</button>
          {chat.chatType === 'direct' && (
            <>
              <button className="action-button" title="Call">📞</button>
              <button className="action-button" title="Video call">📹</button>
            </>
          )}
          {chat.chatType === 'group' && (
            <button 
              className="action-button" 
              title="Group info"
              onClick={() => setShowGroupInfo(true)}
            >
              ℹ️
            </button>
          )}
          <button className="action-button" title="More">⋮</button>
        </div>
      </div>

      {/* Messages Container - Virtualized */}
      <div 
        className="messages-container-responsive"
        ref={messagesContainerRef}
        style={{ height: containerHeight }}
      >
        <MemoizedVirtualizedMessageList
          messages={messages}
          currentUser={user}
          onLoadMore={() => loadMessages(page + 1, true)}
          hasMoreMessages={hasMoreMessages}
          loading={loading}
          typingUsers={typingUsers}
          onMessageAction={handleMessageAction}
          onReplyTo={setReplyingTo}
          containerHeight={containerHeight}
          autoScrollToBottom={true}
          onScroll={handleScroll}
        />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button 
          className="scroll-to-bottom"
          onClick={() => scrollToBottom(true, true)}
        >
          ↓
        </button>
      )}

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

      {/* Group Info Modal */}
      {chat.chatType === 'group' && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          chat={chat}
          onChatUpdate={onChatUpdate}
        />
      )}
    </div>
  );
}
