import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from '../../config/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ChatApp = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        loadMessages();
      } else {
        navigate('/login');
      }
    } catch (error) {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: newMessage.trim(),
          sender_id: user.id,
          message_type: 'text'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      toast.success('Message sent!');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <h1 className="text-xl font-semibold">Real-time Chat</h1>
        <button
          onClick={handleLogout}
          className="text-red-600 hover:text-red-800"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender_id === user?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.sender_id === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-800 border'
              }`}
            >
              <div>{message.content}</div>
              <div className="text-xs mt-1 opacity-70">
                {new Date(message.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatApp;
