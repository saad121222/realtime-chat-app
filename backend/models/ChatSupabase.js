const { supabase } = require('../config/supabase');

class Chat {
  constructor(chatData) {
    this.id = chatData.id;
    this.name = chatData.name;
    this.type = chatData.type; // 'direct' or 'group'
    this.participants = chatData.participants || [];
    this.lastMessage = chatData.last_message;
    this.lastMessageTime = chatData.last_message_time;
    this.createdBy = chatData.created_by;
    this.createdAt = chatData.created_at;
    this.updatedAt = chatData.updated_at;
  }

  // Create a new chat
  static async create(chatData) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .insert([{
          name: chatData.name,
          type: chatData.type || 'direct',
          created_by: chatData.createdBy,
          participants: chatData.participants || []
        }])
        .select()
        .single();

      if (error) throw error;
      return new Chat(data);
    } catch (error) {
      throw new Error(`Failed to create chat: ${error.message}`);
    }
  }

  // Find chat by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          messages:messages(
            id,
            content,
            sender_id,
            created_at,
            message_type
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? new Chat(data) : null;
    } catch (error) {
      throw new Error(`Failed to find chat: ${error.message}`);
    }
  }

  // Find chats for a user
  static async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          messages:messages(
            id,
            content,
            sender_id,
            created_at,
            message_type
          )
        `)
        .contains('participants', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data.map(chat => new Chat(chat));
    } catch (error) {
      throw new Error(`Failed to find user chats: ${error.message}`);
    }
  }

  // Find or create direct chat between two users
  static async findOrCreateDirectChat(userId1, userId2) {
    try {
      // First, try to find existing direct chat
      const { data: existingChat, error: findError } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'direct')
        .contains('participants', [userId1])
        .contains('participants', [userId2])
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      if (existingChat) {
        return new Chat(existingChat);
      }

      // Create new direct chat
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert([{
          name: null, // Direct chats don't need names
          type: 'direct',
          participants: [userId1, userId2],
          created_by: userId1
        }])
        .select()
        .single();

      if (createError) throw createError;
      return new Chat(newChat);
    } catch (error) {
      throw new Error(`Failed to find or create direct chat: ${error.message}`);
    }
  }

  // Update chat's last message
  static async updateLastMessage(chatId, messageContent, messageTime) {
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          last_message: messageContent,
          last_message_time: messageTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Failed to update last message: ${error.message}`);
    }
  }

  // Add participant to group chat
  static async addParticipant(chatId, userId) {
    try {
      // Get current participants
      const { data: chat, error: getError } = await supabase
        .from('chats')
        .select('participants')
        .eq('id', chatId)
        .single();

      if (getError) throw getError;

      const updatedParticipants = [...new Set([...chat.participants, userId])];

      const { error: updateError } = await supabase
        .from('chats')
        .update({
          participants: updatedParticipants,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      throw new Error(`Failed to add participant: ${error.message}`);
    }
  }

  // Remove participant from group chat
  static async removeParticipant(chatId, userId) {
    try {
      // Get current participants
      const { data: chat, error: getError } = await supabase
        .from('chats')
        .select('participants')
        .eq('id', chatId)
        .single();

      if (getError) throw getError;

      const updatedParticipants = chat.participants.filter(id => id !== userId);

      const { error: updateError } = await supabase
        .from('chats')
        .update({
          participants: updatedParticipants,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (updateError) throw updateError;
      return true;
    } catch (error) {
      throw new Error(`Failed to remove participant: ${error.message}`);
    }
  }

  // Delete chat
  static async deleteById(chatId) {
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Failed to delete chat: ${error.message}`);
    }
  }
}

module.exports = Chat;
