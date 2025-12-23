import { config } from '../config';

export class SocketService {
    private ws: WebSocket | null = null;
    private listeners: Set<(data: any) => void> = new Set();
    private reconnectTimer: any = null;

    connect(userId?: string) {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            const wsBaseUrl = config.apiUrl.replace(/^http/, 'ws');
            const token = localStorage.getItem('token');
            const url = token ? `${wsBaseUrl}?token=${token}` : wsBaseUrl;
            
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.listeners.forEach(listener => listener(data));
                } catch (e) {
                    console.error('Failed to parse WebSocket message', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected, reconnecting in 3s...');
                this.ws = null;
                this.reconnectTimer = setTimeout(() => this.connect(userId), 3000);
            };

            this.ws.onerror = (err) => {
                console.error('WebSocket error', err);
            };
        } catch (e) {
            console.error('WebSocket connection failed', e);
            this.reconnectTimer = setTimeout(() => this.connect(userId), 3000);
        }
    }

    addListener(handler: (data: any) => void) {
        this.listeners.add(handler);
        return () => this.removeListener(handler);
    }

    removeListener(handler: (data: any) => void) {
        this.listeners.delete(handler);
    }

    // Alias for compatibility
    onMessage(handler: (data: any) => void) {
        return this.addListener(handler);
    }

    send(data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket not connected, message dropped', data);
        }
    }
}

export const socketService = new SocketService();
