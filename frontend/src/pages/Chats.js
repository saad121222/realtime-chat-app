import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContextEnhanced';
import api from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import NewChatModal from '../components/NewChatModal';
import ProfileModalEnhanced from '../components/ProfileModalEnhanced';
import WelcomeScreen from '../components/WelcomeScreen';

export default function Chats() {
  const { token, user, logout } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // Connect socket when token available
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('connect_error', (err) => {
      toast.error('Socket connection failed');
    });

    socket.on('new_message', ({ message, chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setMessages((prev) => [...prev, message]);
      }
      // update last message in chat list
      setChats((prev) => prev.map(c => c._id === chatId ? { ...c, lastMessage: message, updatedAt: new Date().toISOString() } : c));
    });

    socket.on('message_status_update', ({ messageId, status, userId, chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setMessages((prev) => prev.map(m => m._id === messageId ? { ...m, status } : m));
      }
    });

    socket.on('user_typing', ({ userId, user, chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setTypingUsers(prev => {
          if (!prev.find(u => u.id === userId)) {
            return [...prev, { id: userId, name: user.name }];
          }
          return prev;
        });
      }
    });

    socket.on('user_stop_typing', ({ userId, chatId }) => {
      if (activeChat && chatId === activeChat._id) {
        setTypingUsers(prev => prev.filter(u => u.id !== userId));
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('message_status_update');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [token, activeChat]);

  // Load chats
  const loadChats = async () => {
    try {
      const { data } = await api.get('/chats');
      setChats(data.chats);
      if (!activeChat && data.chats.length) setActiveChat(data.chats[0]);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load chats');
    }
  };

  // Load messages for active chat
  const loadMessages = async (chat) => {
    if (!chat) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/messages/${chat._id}?limit=50`);
      setMessages(data.messages);
      // join room
      const socket = getSocket();
      socket?.emit('join_chat', { chatId: chat._id });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChats(); }, []);
  useEffect(() => { 
    if (activeChat) {
      loadMessages(activeChat);
      setTypingUsers([]); // Clear typing indicators when switching chats
    }
  }, [activeChat?._id]);

  const handleSendText = async (text) => {
    const socket = getSocket();
    if (!socket || !activeChat) return;
    const tempId = `tmp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      content: text,
      sender: { _id: user.id, name: user.name, avatar: user.avatar },
      chat: activeChat._id,
      messageType: 'text',
      status: 'sent',
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempMessage]);
    socket.emit('send_message', { content: text, chatId: activeChat._id, tempId });
  };

  const handleSendFile = async (file) => {
    if (!activeChat) return;
    const formData = new FormData();
    formData.append('chatId', activeChat._id);
    formData.append('file', file);
    try {
      const { data } = await api.post('/messages/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessages((prev) => [...prev, data.data]);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to send file');
    }
  };

  const handleChatCreated = (newChat) => {
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat);
  };

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">WhatsApp Clone</div>
          <div className="user-actions">
            <button className="new-chat-btn" onClick={() => setShowNewChatModal(true)}>+ New Chat</button>
            <button className="user-name" onClick={() => setShowProfileModal(true)}>{user?.name}</button>
            <button className="link" onClick={logout}>Logout</button>
          </div>
        </div>
        <ChatList chats={chats} activeChatId={activeChat?._id} onSelect={setActiveChat} />
      </aside>
      <main className="main">
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            onSendText={handleSendText}
            onSendFile={handleSendFile}
          />
        ) : (
          <WelcomeScreen />
        )}
      </main>
      
      <NewChatModal 
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleChatCreated}
      />
      
      <ProfileModalEnhanced
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}
