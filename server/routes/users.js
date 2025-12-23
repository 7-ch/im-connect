import express from 'express';

import prisma from '../db.js';
import { sendResponse, authMiddleware } from '../utils.js';

const router = express.Router();

// Get User Profile
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        if (!user) return sendResponse(res, null, false, 'User not found', 404);
        sendResponse(res, user);
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

// Protect routes
// Get Contacts (Searchable, Paginated)
router.post('/:role/contacts', async (req, res) => {
    const { role } = req.params;
    const { page = 1, limit = 10, search } = req.body;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const targetRole = role === 'enterprise' ? 'expert' : 'enterprise';

        const where = { role: targetRole };
        if (search) {
            if (targetRole === 'expert') {
                where.OR = [
                    { name: { contains: search } },
                    { title: { contains: search } },
                    { specialty: { contains: search } }
                ];
            } else {
                where.OR = [
                    { name: { contains: search } }, // Search contact name
                    { organization: { contains: search } }, // Search enterprise name
                    { creditCode: { contains: search } } // Search credit code
                ];
            }
        }

        // Count total
        const total = await prisma.user.count({ where });

        const contacts = await prisma.user.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { createdAt: 'desc' } // or consistent order
        });

        sendResponse(res, {
            data: contacts,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (e) {
        sendResponse(res, null, false, e.message, 500);
    }
});

export default router;
