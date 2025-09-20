// Simple in-memory database for development/testing
const users = new Map();
const chats = new Map();
const messages = new Map();

let userIdCounter = 1;
let chatIdCounter = 1;
let messageIdCounter = 1;

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

class MemoryDB {
  // Users
  static createUser(userData) {
    const id = generateId();
    const user = { _id: id, ...userData, createdAt: new Date(), updatedAt: new Date() };
    users.set(id, user);
    return user;
  }

  static findUserByEmail(email) {
    for (const user of users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  static findUserById(id) {
    return users.get(id) || null;
  }

  static updateUser(id, updates) {
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates, { updatedAt: new Date() });
    return user;
  }

  // Chats
  static createChat(chatData) {
    const id = generateId();
    const chat = { _id: id, ...chatData, createdAt: new Date(), updatedAt: new Date() };
    chats.set(id, chat);
    return chat;
  }

  static findChatsByUser(userId) {
    return Array.from(chats.values())
      .filter(chat => chat.participants.includes(userId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  static findChatById(id) {
    return chats.get(id) || null;
  }

  static updateChat(id, updates) {
    const chat = chats.get(id);
    if (!chat) return null;
    Object.assign(chat, updates, { updatedAt: new Date() });
    return chat;
  }

  // Messages
  static createMessage(messageData) {
    const id = generateId();
    const message = { _id: id, ...messageData, createdAt: new Date(), updatedAt: new Date() };
    messages.set(id, message);
    return message;
  }

  static findMessagesByChat(chatId, limit = 50) {
    return Array.from(messages.values())
      .filter(msg => msg.chat === chatId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  }

  static findMessageById(id) {
    return messages.get(id) || null;
  }

  static updateMessage(id, updates) {
    const message = messages.get(id);
    if (!message) return null;
    Object.assign(message, updates, { updatedAt: new Date() });
    return message;
  }

  static deleteMessage(id) {
    return messages.delete(id);
  }

  // Utility
  static getAllUsers() {
    return Array.from(users.values());
  }
}

module.exports = MemoryDB;
