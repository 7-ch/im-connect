
export type Role = 'enterprise' | 'expert';

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'link';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface PaginatedResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: Role;
  title?: string; // e.g., "Senior Safety Engineer" or "Factory Manager"
  organization?: string; // e.g., "TechSafety Corp" or "ABC Manufacturing"
  mobile?: string;
  enterpriseType?: 'Technology' | 'Manufacturing' | 'Service' | 'Other';
  address?: string;
  latitude?: number;
  longitude?: number;
  creditCode?: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string; // Text content or URL for media
  fileName?: string; // For files
  fileSize?: string; // For files
  type: MessageType;
  timestamp: number;
  status: MessageStatus;
  recalled?: boolean; // New property for message recall functionality
  receiverId?: string; // Target for the message
  uploadProgress?: number; // Upload progress percentage (0-100)
}

export interface Conversation {
  id: string;
  participantId: string; // The other person
  participant?: User; // Populated by API
  unreadCount: number;
  lastMessage?: Message;
  pinned: boolean;
}

// Data structures for the Contacts tab
export interface ExpertProfile {
  id: string;
  name: string;
  avatar?: string;
  title: string;
  bio: string;
  specialty: string[];
  mobile?: string;
}

export interface ContactPerson {
  name: string;
  phone: string;
  isPrimary: boolean;
}

export interface EnterpriseProfile {
  id: string;
  name: string;
  avatar?: string;
  village: string; // "Village/Community"
  type: 'Production' | 'FireSafety' | 'Other';
  creditCode: string; // Social Credit Code
  contacts: ContactPerson[];
}

export interface OssConfig {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  bucket: string;
  region: string;
  endpoint: string;
  dir: string;
  host?: string;
  expiration?: string;
}