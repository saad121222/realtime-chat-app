import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { VariableSizeList as VariableList } from 'react-window';
import MessageBubbleEnhanced from './MessageBubbleEnhanced';
import TypingIndicatorEnhanced from './TypingIndicatorEnhanced';

const ITEM_HEIGHT = 80; // Estimated height for fixed size items
const OVERSCAN_COUNT = 5; // Number of items to render outside visible area
const SCROLL_DEBOUNCE_MS = 100;

export default function VirtualizedMessageList({
  messages = [],
  currentUser,
  onLoadMore,
  hasMoreMessages,
  loading,
  typingUsers = [],
  onMessageAction,
  onReplyTo,
  containerHeight,
  autoScrollToBottom = true,
  onScroll
}) {
  const [itemHeights, setItemHeights] = useState(new Map());
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  const listRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const measurementCache = useRef(new Map());
  const isNearBottom = useRef(true);

  // Memoize processed messages to prevent unnecessary re-renders
  const processedMessages = useMemo(() => {
    return messages.map((message, index) => ({
      ...message,
      index,
      isFirst: index === 0 || messages[index - 1]?.sender?._id !== message.sender?._id,
      isLast: index === messages.length - 1 || messages[index + 1]?.sender?._id !== message.sender?._id,
      showTimestamp: index === 0 || 
        (new Date(message.createdAt) - new Date(messages[index - 1]?.createdAt)) > 300000 // 5 minutes
    }));
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScrollToBottom && messages.length > lastMessageCount && isNearBottom.current) {
      scrollToBottom();
    }
    setLastMessageCount(messages.length);
  }, [messages.length, lastMessageCount, autoScrollToBottom]);

  // Estimate item height based on message content
  const getEstimatedHeight = useCallback((message) => {
    if (measurementCache.current.has(message._id)) {
      return measurementCache.current.get(message._id);
    }

    let height = 60; // Base height
    
    // Add height for content
    if (message.content) {
      const lines = Math.ceil(message.content.length / 50); // Rough estimate
      height += lines * 20;
    }
    
    // Add height for media
    if (message.messageType === 'image' || message.messageType === 'video') {
      height += 200;
    } else if (message.messageType === 'document') {
      height += 80;
    } else if (message.messageType === 'audio') {
      height += 60;
    }
    
    // Add height for timestamp
    if (message.showTimestamp) {
      height += 30;
    }
    
    // Add height for reply
    if (message.replyTo) {
      height += 40;
    }

    measurementCache.current.set(message._id, height);
    return height;
  }, []);

  // Get item height for variable size list
  const getItemHeight = useCallback((index) => {
    if (index >= processedMessages.length) return ITEM_HEIGHT;
    
    const message = processedMessages[index];
    const cachedHeight = itemHeights.get(message._id);
    
    if (cachedHeight) {
      return cachedHeight;
    }
    
    return getEstimatedHeight(message);
  }, [processedMessages, itemHeights, getEstimatedHeight]);

  // Set item height after measurement
  const setItemHeight = useCallback((messageId, height) => {
    setItemHeights(prev => {
      const newHeights = new Map(prev);
      newHeights.set(messageId, height);
      return newHeights;
    });
    
    // Update cache
    measurementCache.current.set(messageId, height);
    
    // Reset list cache to trigger re-render with new heights
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!listRef.current) return;
    
    setIsAutoScrolling(true);
    
    try {
      listRef.current.scrollToItem(processedMessages.length - 1, 'end');
    } catch (error) {
      console.warn('Error scrolling to bottom:', error);
    }
    
    setTimeout(() => setIsAutoScrolling(false), 100);
  }, [processedMessages.length]);

  // Handle scroll events
  const handleScroll = useCallback(({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
    if (scrollUpdateWasRequested || isAutoScrolling) return;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounced scroll handling
    scrollTimeoutRef.current = setTimeout(() => {
      const container = listRef.current;
      if (!container) return;

      const { scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollOffset - clientHeight;
      
      // Update near bottom status
      isNearBottom.current = distanceFromBottom < 100;
      
      // Show/hide scroll to bottom button
      setShowScrollToBottom(distanceFromBottom > 200);

      // Load more messages when scrolling to top
      if (scrollOffset < 100 && hasMoreMessages && !loading) {
        onLoadMore?.();
      }

      // Call external scroll handler
      onScroll?.({ scrollDirection, scrollOffset, scrollUpdateWasRequested });
    }, SCROLL_DEBOUNCE_MS);
  }, [hasMoreMessages, loading, onLoadMore, onScroll, isAutoScrolling]);

  // Message item renderer
  const MessageItem = useCallback(({ index, style }) => {
    if (index >= processedMessages.length) {
      return (
        <div style={style} className="message-loading">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    const message = processedMessages[index];
    const isOwn = message.sender?._id === currentUser?.id;

    return (
      <div style={style} className="virtualized-message-item">
        <MessageBubbleEnhanced
          message={message}
          isOwn={isOwn}
          showAvatar={message.isFirst}
          showTimestamp={message.showTimestamp}
          onAction={onMessageAction}
          onReplyTo={onReplyTo}
          onHeightMeasured={(height) => setItemHeight(message._id, height)}
        />
      </div>
    );
  }, [processedMessages, currentUser, onMessageAction, onReplyTo, setItemHeight]);

  // Typing indicator item
  const TypingItem = useCallback(({ style }) => (
    <div style={style} className="virtualized-typing-item">
      <TypingIndicatorEnhanced users={typingUsers} />
    </div>
  ), [typingUsers]);

  // Calculate total items (messages + typing indicator)
  const totalItems = processedMessages.length + (typingUsers.length > 0 ? 1 : 0);

  // Item renderer that handles both messages and typing indicator
  const ItemRenderer = useCallback(({ index, style }) => {
    if (index < processedMessages.length) {
      return <MessageItem index={index} style={style} />;
    } else {
      return <TypingItem style={style} />;
    }
  }, [processedMessages.length, MessageItem, TypingItem]);

  // Get height for item (including typing indicator)
  const getItemHeightWithTyping = useCallback((index) => {
    if (index < processedMessages.length) {
      return getItemHeight(index);
    } else {
      return 60; // Height for typing indicator
    }
  }, [processedMessages.length, getItemHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="virtualized-message-list" style={{ height: containerHeight }}>
      {/* Loading indicator at top */}
      {loading && (
        <div className="load-more-indicator">
          <div className="loading-spinner"></div>
          <span>Loading messages...</span>
        </div>
      )}

      {/* Virtualized list */}
      <VariableList
        ref={listRef}
        height={containerHeight - (loading ? 40 : 0)}
        itemCount={totalItems}
        itemSize={getItemHeightWithTyping}
        onScroll={handleScroll}
        overscanCount={OVERSCAN_COUNT}
        className="message-list-container"
      >
        {ItemRenderer}
      </VariableList>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={() => scrollToBottom(true)}
          title="Scroll to bottom"
        >
          <span className="scroll-icon">↓</span>
          {/* Show unread count if available */}
        </button>
      )}
    </div>
  );
}

// Performance optimization: Memoize the component
export const MemoizedVirtualizedMessageList = React.memo(VirtualizedMessageList, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages[prevProps.messages.length - 1]?._id === nextProps.messages[nextProps.messages.length - 1]?._id &&
    prevProps.typingUsers.length === nextProps.typingUsers.length &&
    prevProps.loading === nextProps.loading &&
    prevProps.hasMoreMessages === nextProps.hasMoreMessages &&
    prevProps.containerHeight === nextProps.containerHeight
  );
});
