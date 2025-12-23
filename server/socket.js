import { WebSocketServer, WebSocket } from 'ws';

import { verifyToken } from './utils.js';

export const clients = new Map(); // Map<userId, WebSocket>

// Broadcast helper
export const broadcast = (data) => {
    const msg = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
};

export const initWebSocket = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        // Parse token from URL params
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        let userId = null;

        if (token) {
            userId = verifyToken(token);
        }

        if (!userId) {
            console.log('WS Connection rejected: Invalid or missing token');
            ws.close(1008, 'Authentication failed');
            return;
        }

        ws.userId = userId;
        clients.set(userId, ws);
        console.log(`User connected: ${userId}. Total: ${clients.size}`);

        // 1. Broadcast to others that this user is online
        broadcast({
            type: 'USER_STATUS',
            payload: { userId, status: 'online' }
        });

        // 2. Send current online list to this user
        const onlineList = Array.from(clients.keys());
        ws.send(JSON.stringify({
            type: 'ONLINE_USERS_LIST',
            payload: onlineList
        }));

        ws.on('message', async (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                // console.log('WS Received:', parsed.type);

                if (parsed.type === 'NEW_MESSAGE') {
                    const msg = parsed.payload;
                    const receiverWs = clients.get(msg.receiverId);
                    if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
                        receiverWs.send(JSON.stringify(parsed));
                    }
                    broadcast(parsed);
                }
            } catch (e) {
                console.error('WS Error:', e);
            }
        });

        ws.on('close', () => {
            if (ws.userId) {
                clients.delete(ws.userId);
                console.log(`User disconnected: ${ws.userId}. Total: ${clients.size}`);

                broadcast({
                    type: 'USER_STATUS',
                    payload: { userId: ws.userId, status: 'offline' }
                });
            }
        });
    });

    return wss;
};
