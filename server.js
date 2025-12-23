import 'dotenv/config';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';


// Routes Imports
import authRoutes from './server/routes/auth.js';
import messageRoutes from './server/routes/messages.js'; // Mounts /api/conversations AND /api/messages?
import uploadRoutes from './server/routes/upload.js'; // Mount at /api
import userRoutes from './server/routes/users.js';
import { seed } from './server/seed.js';
import { initWebSocket } from './server/socket.js';
import { authMiddleware } from './server/utils.js';

const app = express();
const port = 8080;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// Mount Routes
// 1. /api/auth (Public)
app.use('/api/auth', authRoutes);

// 2. Global Auth Middleware (Protects all subsequent /api routes)
app.use('/api', authMiddleware);

// 3. Protected Routes
app.use('/api/users', userRoutes);
app.use('/api', messageRoutes); // Contains /conversations and /messages (after refactor)
app.use('/api', uploadRoutes); // Contains /oss/config (and /upload if enabled)

// 4. Serve Frontend (Static Files)
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// 5. SPA Fallback (Must be last)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
});

// HTTP Server
const server = createServer(app);

// WebSocket Init
initWebSocket(server);

server.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
    seed();
});
