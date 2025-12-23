import express from 'express';

import prisma from '../db.js';
import { broadcast, clients } from '../socket.js';
import { sendResponse } from '../utils.js';

const router = express.Router();

// 2. Get Conversations for a User
router.get('/conversations', async (req, res) => {
    // Correctly get userId from globally injected req.user
    const userId = req.user?.id;
    if (!userId) {
        return sendResponse(res, null, false, 'Unauthorized', 401);
    }

    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: String(userId) },
            orderBy: { updatedAt: 'desc' }
        });

        // Manual populate lastMessage
        // (Schema design uses separate Conversation entries per user, but Message is shared)
        const result = await Promise.all(conversations.map(async (c) => {
            const lastMessage = await prisma.message.findFirst({
                where: {
                    OR: [
                        { senderId: c.userId, receiverId: c.participantId },
                        { senderId: c.participantId, receiverId: c.userId }
                    ]
                },
                orderBy: { timestamp: 'desc' }
            });

            const participant = await prisma.user.findUnique({
                where: { id: c.participantId },
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    role: true,
                    title: true,
                    organization: true
                }
            });

            return {
                ...c,
                lastMessage,
                participant
            };
        }));

        sendResponse(res, result);
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

// 3. Create or Get Conversation
router.post('/conversations', async (req, res) => {
    const { participantId } = req.body; // Remove userId from body
    const userId = req.user?.id;

    if (!userId) return sendResponse(res, null, false, 'Unauthorized', 401);
    if (!participantId) return sendResponse(res, null, false, 'Missing participantId', 400);

    try {
        // Check if exists
        let conv = await prisma.conversation.findFirst({
            where: {
                userId,
                participantId
            }
        });

        if (!conv) {
            conv = await prisma.conversation.create({
                data: {
                    userId,
                    participantId,
                    unreadCount: 0
                }
            });
        }
        const participant = await prisma.user.findUnique({
            where: { id: participantId }, // The other person in the conversation
            select: {
                id: true,
                name: true,
                avatar: true,
                role: true,
                title: true,
                organization: true
            }
        });

        sendResponse(res, { ...conv, participant });
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

// 4. Get Messages
router.get('/messages', async (req, res) => {
    const { otherUserId, page = 1, limit = 20 } = req.query;
    const currentUserId = req.user?.id;

    if (!currentUserId) return sendResponse(res, null, false, 'Unauthorized', 401);
    if (!otherUserId) return sendResponse(res, null, false, 'Missing otherUserId', 400);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: String(currentUserId), receiverId: String(otherUserId) },
                    { senderId: String(otherUserId), receiverId: String(currentUserId) }
                ]
            },
            orderBy: { timestamp: 'desc' }, // Get newest first
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });

        // Reverse to return chronological order (oldest to newest)
        const sortedMessages = messages.reverse();

        sendResponse(res, sortedMessages);
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

// 5. Send Message
router.post('/messages', async (req, res) => {
    const { receiverId, content, type, fileName, fileSize } = req.body;
    const senderId = req.user?.id;

    if (!senderId) return sendResponse(res, null, false, 'Unauthorized', 401);
    if (!receiverId) return sendResponse(res, null, false, 'Missing receiverId', 400);

    try {
        const msg = await prisma.message.create({
            data: {
                senderId,
                receiverId,
                content,
                type,
                fileName,
                fileSize,
                status: 'sent'
            }
        });

        // Update Conversation updatedAt for Sender
        await prisma.conversation.updateMany({
            where: { userId: senderId, participantId: receiverId },
            data: { updatedAt: new Date() }
        });

        // Update Conversation for Receiver
        const receiverConv = await prisma.conversation.findFirst({
            where: { userId: receiverId, participantId: senderId }
        });

        if (receiverConv) {
            await prisma.conversation.update({
                where: { id: receiverConv.id },
                data: {
                    updatedAt: new Date(),
                    unreadCount: { increment: 1 }
                }
            });
        } else {
            await prisma.conversation.create({
                data: {
                    userId: receiverId,
                    participantId: senderId,
                    unreadCount: 1,
                    updatedAt: new Date()
                }
            });
        }

        // Broadcast via WS
        const broadcastData = {
            type: 'NEW_MESSAGE',
            payload: { ...msg, timestamp: msg.timestamp.getTime() } // Send millis
        };

        broadcast(broadcastData);

        sendResponse(res, msg);
    } catch (e) {
        console.error(e);
        sendResponse(res, null, false, e.message, 500);
    }
});

// 6. Mark Messages as Read
router.post('/messages/read', async (req, res) => {
    const { participantId } = req.body;
    const userId = req.user?.id;

    if (!userId) return sendResponse(res, null, false, 'Unauthorized', 401);
    // participantId is the REMOTE user who SENT the messages we are reading

    try {
        // 1. Update Messages (Sender = Participant, Receiver = User)
        await prisma.message.updateMany({
            where: {
                senderId: participantId,
                receiverId: userId,
                status: { not: 'read' }
            },
            data: { status: 'read' }
        });

        // 2. Reset Unread Count for User
        const conv = await prisma.conversation.findFirst({
            where: { userId, participantId }
        });

        if (conv) {
            await prisma.conversation.update({
                where: { id: conv.id },
                data: { unreadCount: 0 }
            });
        }

        // 3. Broadcast Read Event (to let the *Sender* know their messages were read)
        const broadcastData = {
            type: 'MESSAGES_READ',
            payload: {
                readerId: userId, // User who read the messages
                targetId: participantId // User whose messages were read (The Sender)
            }
        };

        broadcast(broadcastData);

        sendResponse(res, { success: true });
    } catch (e) {
        console.error('Mark read failed', e);
        sendResponse(res, null, false, e.message, 500);
    }
});

// 7. Recall Message
router.post('/messages/recall', async (req, res) => {
    const { messageId } = req.body;
    const userId = req.user?.id;

    if (!userId) return sendResponse(res, null, false, 'Unauthorized', 401);

    try {
        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return sendResponse(res, null, false, 'Message not found', 404);
        }

        if (message.senderId !== userId) {
            return sendResponse(res, null, false, 'Unauthorized', 403);
        }

        // Check time limit (24 hours)
        const now = Date.now();
        const msgTime = new Date(message.timestamp).getTime();
        if (now - msgTime > 24 * 60 * 60 * 1000) {
            return sendResponse(res, null, false, 'Message is too old to recall (limit: 24h)', 400);
        }

        // Update message
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { recalled: true }
        });

        // Broadcast Recall Event
        const broadcastData = {
            type: 'MESSAGE_RECALLED',
            payload: {
                id: messageId,
                conversationId: message.conversationId,
                senderId: message.senderId,
                receiverId: message.receiverId
            }
        };

        broadcast(broadcastData);

        sendResponse(res, updatedMessage);

    } catch (e) {
        console.error('Recall failed', e);
        sendResponse(res, null, false, e.message, 500);
    }
});

export default router;
