const { supabase } = require('../config/supabase');

class Message {
  constructor(messageData) {
    this.id = messageData.id;
    this.chatId = messageData.chat_id;
    this.senderId = messageData.sender_id;
    this.content = messageData.content;
    this.messageType = messageData.message_type || 'text';
    this.fileUrl = messageData.file_url;
    this.fileName = messageData.file_name;
    this.fileSize = messageData.file_size;
    this.isRead = messageData.is_read || false;
    this.readBy = messageData.read_by || [];
    this.createdAt = messageData.created_at;
    this.updatedAt = messageData.updated_at;
  }

  // Create a new message
  static async create(messageData) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          chat_id: messageData.chatId,
          sender_id: messageData.senderId,
          content: messageData.content,
          message_type: messageData.messageType || 'text',
          file_url: messageData.fileUrl || null,
          file_name: messageData.fileName || null,
          file_size: messageData.fileSize || null,
          is_read: false,
          read_by: []
        }])
        .select()
        .single();

      if (error) throw error;
      return new Message(data);
    } catch (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  // Find message by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, username, avatar),
          chat:chats!chat_id(id, name, type)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? new Message(data) : null;
    } catch (error) {
      throw new Error(`Failed to find message: ${error.message}`);
    }
  }

  // Get messages for a chat
  static async findByChatId(chatId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, username, avatar)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data.map(message => new Message(message)).reverse();
    } catch (error) {
      throw new Error(`Failed to get chat messages: ${error.message}`);
    }
  }

  // Mark message as read by user
  static async markAsRead(messageId, userId) {
    try {
      // Get current read_by array
      const { data: message, error: getError } = await supabase
        .from('messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (getError) throw getError;

      const updatedReadBy = [...new Set([...message.read_by, userId])];

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          read_by: updatedReadBy,
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }

  // Mark all messages in chat as read by user
  static async markChatAsRead(chatId, userId) {
    try {
      const { error } = await supabase.rpc('mark_chat_messages_as_read', {
        p_chat_id: chatId,
        p_user_id: userId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Failed to mark chat as read: ${error.message}`);
    }
  }

  // Get unread message count for user
  static async getUnreadCount(userId) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .neq('sender_id', userId)
        .not('read_by', 'cs', `[${userId}]`);

      if (error) throw error;
      return data.length;
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  // Delete message
  static async deleteById(messageId) {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  // Update message content
  static async updateContent(messageId, newContent) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return new Message(data);
    } catch (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }

  // Search messages in chat
  static async searchInChat(chatId, query, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, username, avatar)
        `)
        .eq('chat_id', chatId)
        .textSearch('content', query)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data.map(message => new Message(message));
    } catch (error) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }
}

module.exports = Message;
