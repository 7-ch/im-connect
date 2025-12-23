import { Conversation, Message, User, PaginatedResponse } from '@/types';
import { http } from '@/utils/request';

export const chatService = {
  // Auth
  login: (data: { username: string; password: string }) => {
    return http.post<User>('/api/auth/login', data);
  },

  // Get Contacts
  getContacts: (role: string, page: number = 1, limit: number = 10, search?: string) => {
    return http.post<PaginatedResponse<User[]> | User[]>(`/api/users/${role}/contacts`, { page, limit, search });
  },

  getUserProfile: (id: string) => {
    return http.get<User>(`/api/users/${id}`);
  },

  // Get Conversations
  getConversations: () => {
    return http.get<Conversation[]>('/api/conversations');
  },

  // Create or Get Conversation
  startChat: (userId: string, participantId: string) => {
    return http.post<Conversation>('/api/conversations', { userId, participantId });
  },

  // Get Messages
  getMessages: (currentUserId: string, otherUserId: string, page: number = 1, limit: number = 20) => {
    return http.get<Message[]>('/api/messages', { currentUserId, otherUserId, page, limit });
  },

  // Send Message
  sendMessage: (data: { senderId: string; receiverId: string; content: string; type: string; fileName?: string; fileSize?: string }) => {
    return http.post<Message>('/api/messages', data);
  },

  // Mark Messages as Read
  markAsRead: (userId: string, participantId: string) => {
    return http.post('/api/messages/read', { userId, participantId });
  },

  // Recall Message
  recallMessage: (messageId: string, userId: string) => {
    return http.post<Message>('/api/messages/recall', { messageId, userId });
  },

  // Get OSS Config
  getOssConfig: () => {
    return http.post<any>('/api/oss/config');
  }
};