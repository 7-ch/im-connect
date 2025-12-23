import express from 'express';
import prisma from '../db.js';
import { sendResponse, generateToken } from '../utils.js';

const router = express.Router();

// Auth Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user || user.password !== password) {
            return sendResponse(res, null, false, 'Invalid credentials', 401);
        }

        const token = generateToken(user);

        // Return user AND token
        sendResponse(res, { ...user, token });
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

export default router;
