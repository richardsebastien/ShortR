import crypto from 'crypto';

export function csrfTokenSync(req, res, next) {
    if (req.session) {
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }
        res.cookie('XSRF-TOKEN', req.session.csrfToken, {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        });
    }
    next();
}

export function csrfProtection(req, res, next) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const publicEndpoints = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password',
        '/api/auth/reset-password'
    ];

    if (publicEndpoints.includes(req.path) || req.path.startsWith('/api/unlock/')) {
        return next();
    }

    // If it's a POST to /api/shorten and the user is NOT logged in (no userId), allow it without CSRF.
    if (req.path === '/api/shorten' && !req.session.userId) {
        return next();
    }

    const userToken = req.headers['x-csrf-token'];
    if (!userToken || userToken !== req.session.csrfToken) {
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
    next();
}
