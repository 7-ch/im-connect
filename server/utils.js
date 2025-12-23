
// Helper for standard response
export const sendResponse = (res, data, success = true, message = 'Success', code = 200) => {
    res.json({
        success,
        code: success ? 200 : (code || 500),
        message,
        data
    });
};

// Simple Token Helper
export const generateToken = (user) => {
    return Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
};

// Verify Token Helper
export const verifyToken = (token) => {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userId] = decoded.split(':');
        if (!userId) return null;
        return userId;
    } catch (e) {
        return null;
    }
};

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return sendResponse(res, null, false, 'No token provided', 401);

    const userId = verifyToken(token);
    if (!userId) return sendResponse(res, null, false, 'Invalid token', 403);

    req.user = { id: userId };
    next();
};
