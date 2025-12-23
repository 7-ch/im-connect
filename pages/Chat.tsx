import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
import { MessageCircle, Users, Layout } from 'lucide-react';

import Avatar from '../components/Avatar';
import ChatDetail from '../components/ChatDetail';
import ChatList from '../components/ChatList';
import ContactList from '../components/ContactList';
import { chatService } from '../services/api';
import { socketService } from '../services/socketService';
import { User, Role } from '../types';

interface ChatProps {
    currentUser: User;
    handleLogout: () => void;
}

const Chat: React.FC<ChatProps> = ({ currentUser, handleLogout }) => {
    const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    // Use real user data
    const currentUserRole = currentUser.role;
    const currentUserId = currentUser._id || currentUser.id; // Fallback to id if _id missing, or check usage

    // Fetch conversations and Connect Socket
    useEffect(() => {
        if (!currentUserId) return;

        const fetchConversations = async () => {
            try {
                const res = await chatService.getConversations();
                if ((res as any).success) {
                    setConversations((res as any).data || []);
                } else if (Array.isArray(res)) {
                    setConversations(res);
                }
            } catch (e) {
                console.error(e);
            }
        };

        // Fetch immediately
        fetchConversations();

        // Connect socket
        socketService.connect(currentUserId);
    }, [currentUserId]);

    // Ref to track conversations for socket handlers without re-subscribing
    const conversationsRef = React.useRef(conversations);
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    // Socket Listener
    useEffect(() => {
        if (!currentUserId) return;

        const handleSocketMsg = async (data: any) => {
            // Handle Online Status
            if (data.type === 'ONLINE_USERS_LIST') {
                setOnlineUsers(new Set(data.payload));
            } else if (data.type === 'USER_STATUS') {
                const { userId, status } = data.payload;
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    if (status === 'online') next.add(userId);
                    else next.delete(userId);
                    return next;
                });
            }

            if (data.type === 'NEW_MESSAGE') {
                const msg = data.payload;
                const otherId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;

                // Check if conversation exists using Ref
                const exists = conversationsRef.current.find(c => c.participantId === otherId);

                if (exists) {
                    setConversations(prev => {
                        return prev.map(c => {
                            const isRelevant = c.participantId === otherId;
                            if (isRelevant) {
                                return {
                                    ...c,
                                    lastMessage: msg,
                                    unreadCount: (msg.senderId !== currentUserId && c.id !== selectedChatId) ? (c.unreadCount || 0) + 1 : c.unreadCount,
                                    updatedAt: new Date(msg.timestamp).toISOString() // Update time for sorting
                                };
                            }
                            return c;
                        }).sort((a, b) => {
                            const timeA = new Date(a.lastMessage?.timestamp || a.updatedAt || 0).getTime();
                            const timeB = new Date(b.lastMessage?.timestamp || b.updatedAt || 0).getTime();
                            return timeB - timeA;
                        });
                    });
                } else {
                    // New Conversation - Fetch Profile
                    try {
                        console.log('Fetching new conversation profile for:', otherId); // Debug log
                        if (!otherId) {
                            console.warn('Invalid otherId, skipping fetch');
                            return;
                        }
                        // Assuming fetch profile is fast; for better UX, could show loading or placeholder
                        const res = await chatService.getUserProfile(otherId);
                        const user = (res as any).success ? (res as any).data : res;

                        if (user) {
                            const newConv = {
                                id: msg.conversationId || `temp_${Date.now()}_${otherId}`, // Temporary or real ID
                                userId: currentUserId,
                                participantId: otherId,
                                unreadCount: msg.senderId !== currentUserId ? 1 : 0,
                                lastMessage: msg,
                                participant: user,
                                updatedAt: new Date(msg.timestamp).toISOString()
                            };
                            setConversations(prev => [newConv, ...prev]);
                        }
                    } catch (e) {
                        console.error('Failed to fetch new conversation user details', e);
                    }
                }
            }

            if (data.type === 'MESSAGES_READ') {
                const { readerId, targetId } = data.payload;
                if (readerId === currentUserId) {
                    setConversations(prev => prev.map(c =>
                        c.participantId === targetId ? { ...c, unreadCount: 0 } : c
                    ));
                }
            }

            if (data.type === 'MESSAGE_RECALLED') {
                const { id, senderId, receiverId } = data.payload;
                setConversations(prev => prev.map(c => {
                    const isRelevant = c.participantId === senderId || c.participantId === receiverId;
                    if (isRelevant && c.lastMessage?.id === id) {
                        return {
                            ...c,
                            lastMessage: { ...c.lastMessage, recalled: true }
                        };
                    }
                    return c;
                }));
            }
        };

        const unsub = socketService.addListener(handleSocketMsg);
        return () => {
            unsub();
        };
    }, [currentUserId, selectedChatId]); // Removed selectedChatId from dependency? No, unread count depends on it.


    const handleSelectChat = (id: string) => {
        setSelectedChatId(id);
    };

    const handleBackToNav = () => {
        setSelectedChatId(null);
    };

    const handleStartChat = async (participantId: string) => {
        try {
            const res = await chatService.startChat(currentUserId, participantId);
            if ((res as any).success) {
                const conv = (res as any).data;
                setConversations(prev => {
                    const exists = prev.find(c => c.id === conv.id);
                    if (exists) return prev;
                    return [conv, ...prev];
                });
                setSelectedChatId(conv.id);
                setActiveTab('chats');
            } else if ((res as any)._id) {
                // Handle direct object return case just in case
                const conv = res as any;
                setConversations(prev => {
                    const exists = prev.find(c => c.id === conv.id);
                    if (exists) return prev;
                    return [conv, ...prev];
                });
                setSelectedChatId(conv.id);
                setActiveTab('chats');
            }
        } catch (e) {
            console.error('Start chat failed', e);
        }
    };

    const getParticipantForDetail = () => {
        if (!selectedChatId) return null;
        const conversation = conversations.find(c => c.id === selectedChatId);
        if (!conversation) return null;
        // Fallback to participantId placeholders if name/role missing (though backend should now populate it)
        return conversation.participant || { id: conversation.participantId, name: '加载中...', role: 'expert' };
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="flex h-screen w-full bg-gray-100 font-sans overflow-hidden items-center justify-center p-0 md:p-4 lg:p-8"
        >
            <div className="flex h-full w-full max-w-[1200px] bg-white md:rounded-2xl shadow-2xl overflow-hidden relative border border-gray-200">
                <div className={`flex flex-col w-full md:w-80 lg:w-96 h-full bg-white transition-all duration-300 ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="flex border-b border-gray-200 h-16 flex-shrink-0">
                        <button
                            onClick={() => setActiveTab('chats')}
                            className={`flex-1 h-full text-sm font-medium flex items-center justify-center transition-colors relative ${activeTab === 'chats' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <MessageCircle size={18} className="mr-2" />
                            在线对话
                            {activeTab === 'chats' && <div className="absolute bottom-0 w-full h-0.5 bg-blue-600"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('contacts')}
                            className={`flex-1 h-full text-sm font-medium flex items-center justify-center transition-colors relative ${activeTab === 'contacts' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <Users size={18} className="mr-2" />
                            通讯录
                            {activeTab === 'contacts' && <div className="absolute bottom-0 w-full h-0.5 bg-blue-600"></div>}
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {activeTab === 'chats' ? (
                            <ChatList
                                conversations={conversations}
                                activeId={selectedChatId}
                                onSelect={handleSelectChat}
                                currentUserRole={currentUserRole}
                                onlineUsers={onlineUsers}
                            />
                        ) : (
                            <ContactList
                                currentUserRole={currentUserRole}
                                onStartChat={handleStartChat}
                            />
                        )}
                    </div>

                    <div className="p-3 bg-white border-t border-gray-200 flex items-center justify-between text-xs flex-shrink-0">
                        <div className="flex items-center">
                            <Avatar name={currentUser.name} src={currentUser.avatar} size="sm" />
                            <div className="ml-2 flex flex-col">
                                <span className="font-bold text-gray-900 text-sm">{currentUser.name}</span>
                                <span className="text-gray-500 text-xs truncate max-w-[120px]">
                                    {currentUser.organization || currentUser.title || (currentUserRole === 'enterprise' ? '企业用户' : '专家顾问')}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleLogout}
                                className="text-gray-500 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                title="退出登录"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`flex-1 h-full bg-gray-50 ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
                    <ChatDetail
                        participant={getParticipantForDetail()}
                        onBack={handleBackToNav}
                        currentUserRole={currentUserRole}
                        currentUserId={currentUserId}
                        isOnline={getParticipantForDetail() ? onlineUsers.has(getParticipantForDetail()!.id) : false}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default Chat;
