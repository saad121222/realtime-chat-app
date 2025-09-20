const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.username = userData.username;
    this.email = userData.email;
    this.phone = userData.phone;
    this.avatar = userData.avatar;
    this.isOnline = userData.is_online || false;
    this.lastSeen = userData.last_seen;
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
  }

  // Create user table if it doesn't exist
  static async createTable() {
    const { error } = await supabase.rpc('create_users_table');
    if (error && !error.message.includes('already exists')) {
      throw error;
    }
  }

  // Create a new user
  static async create(userData) {
    try {
      // Hash password if provided
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password_hash = await bcrypt.hash(userData.password, salt);
        delete userData.password;
      }

      const { data, error } = await supabase
        .from('users')
        .insert([{
          username: userData.username,
          email: userData.email,
          phone: userData.phone,
          password_hash: userData.password_hash,
          avatar: userData.avatar || null,
          is_online: false,
          last_seen: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return new User(data);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? new User(data) : null;
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? new User(data) : null;
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  // Find user by username
  static async findByUsername(username) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? new User(data) : null;
    } catch (error) {
      throw new Error(`Failed to find user by username: ${error.message}`);
    }
  }

  // Validate password
  static async validatePassword(user, password) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return await bcrypt.compare(password, data.password_hash);
    } catch (error) {
      throw new Error(`Failed to validate password: ${error.message}`);
    }
  }

  // Update user online status
  static async updateOnlineStatus(userId, isOnline) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw new Error(`Failed to update online status: ${error.message}`);
    }
  }

  // Update user profile
  static async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return new User(data);
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  // Get all users (for contacts)
  static async findAll(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, avatar, is_online, last_seen')
        .order('username')
        .limit(limit);

      if (error) throw error;
      return data.map(user => new User(user));
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  // Search users
  static async search(query, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, avatar, is_online, last_seen')
        .or(`username.ilike.%${query}%, email.ilike.%${query}%`)
        .order('username')
        .limit(limit);

      if (error) throw error;
      return data.map(user => new User(user));
    } catch (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }
}

module.exports = User;
