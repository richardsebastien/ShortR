import { pool } from '../db.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { isValidUrl, isValidCode } from '../utils/validate.js';
import { getClientIp } from '../utils/ip.js';

export async function deleteLink(req, res) {
    try {
        const { code } = req.params;
        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);

        if (!url) {
            return res.status(404).json({ error: 'Link not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await pool.query('DELETE FROM urls WHERE id = ?', [url.id]);

        res.status(204).send(); // No Content
    } catch (e) {
        console.error('Error deleting link:', e);
        res.status(500).json({ error: 'Server error' });
    }
}

export async function updateLink(req, res) {
    try {
        const { code } = req.params;
        const { newCode } = req.body;

        if (!newCode || !isValidCode(newCode)) {
            return res.status(400).json({ error: 'Invalid new code' });
        }

        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);

        if (!url) {
            return res.status(404).json({ error: 'Link not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [[existing]] = await pool.query('SELECT id FROM urls WHERE code = ?', [newCode]);
        if (existing) {
            return res.status(409).json({ error: 'New code already used' });
        }

        await pool.query('UPDATE urls SET code = ? WHERE id = ?', [newCode, url.id]);

        res.json({ message: 'Link updated successfully', newCode });
    } catch (e) {
        console.error('Error updating link:', e);
        res.status(500).json({ error: 'Server error' });
    }
}

export async function unlockLink(req, res) {
    try {
        const { code } = req.params;
        const { password } = req.body;

        if (!isValidCode(code)) return res.status(404).json({ error: 'Not found' });
        if (!password) return res.status(400).json({ error: 'Password is required' });

        const [[url]] = await pool.query('SELECT password_hash FROM urls WHERE code = ? AND is_active = 1', [code]);
        if (!url || !url.password_hash) {
            return res.status(404).json({ error: 'Link not found or not protected' });
        }

        const matches = await bcrypt.compare(password, url.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        if (!req.session.unlockedLinks) {
            req.session.unlockedLinks = {};
        }
        req.session.unlockedLinks[code] = true;

        res.json({ success: true, message: 'Link unlocked' });
    } catch (e) {
        console.error('Error unlocking link:', e);
        res.status(500).json({ error: 'Server error' });
    }
}

export async function shortenLink(req, res) {
    try {
        // Accept the payload
        const { target, customCode, title, expiresAt, maxClicks, password, mobileTarget } = req.body || {};
        if (!target || !isValidUrl(target)) return res.status(400).json({ error: 'Invalid url' });

        let finalExpiresAt = null;
        if (expiresAt) {
            const date = new Date(expiresAt);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ error: 'Invalid expiration date' });
            }
            if (date <= new Date()) {
                return res.status(400).json({ error: 'Expiration date must be in the future' });
            }
            finalExpiresAt = date;
        }

        let finalMaxClicks = null;
        if (maxClicks !== undefined && maxClicks !== null && maxClicks !== '') {
            const parsedClicks = Number(maxClicks);
            if (!Number.isInteger(parsedClicks) || parsedClicks <= 0) {
                return res.status(400).json({ error: 'Max clicks must be a positive integer' });
            }
            finalMaxClicks = parsedClicks;
        }

        let finalPasswordHash = null;
        if (password !== undefined && password !== null && password !== '') {
            if (typeof password !== 'string' || password.length < 4) {
                return res.status(400).json({ error: 'Password must be at least 4 characters long' });
            }
            finalPasswordHash = await bcrypt.hash(password, 10);
        }

        let finalMobileTarget = null;
        if (mobileTarget !== undefined && mobileTarget !== null && mobileTarget !== '') {
            if (!isValidUrl(mobileTarget)) {
                return res.status(400).json({ error: 'Invalid mobile target URL' });
            }
            finalMobileTarget = mobileTarget;
        }

        let finalCode = customCode && isValidCode(customCode) ? customCode : nanoid(7);

        // Ensure unique code
        const [[existing]] = await pool.query('SELECT id FROM urls WHERE code = ?', [finalCode]);
        if (existing) {
            if (customCode) return res.status(409).json({ error: 'Code already used' });
            finalCode = nanoid(8);
        }

        await pool.query('INSERT INTO urls (code, target, title, is_active, created_ip, user_id, expires_at, max_clicks, password_hash, mobile_target) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)', [
            finalCode,
            target,
            title || null,
            getClientIp(req),
            req.session.userId || null,
            finalExpiresAt,
            finalMaxClicks,
            finalPasswordHash,
            finalMobileTarget
        ]);

        const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
        const shortUrl = `${base}/${finalCode}`;
        const qrUrl = `${base}/qr/${finalCode}.png`;

        return res.status(201).json({ code: finalCode, shortUrl, target, qrUrl });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
}

export async function getUserLinks(req, res) {
    try {
        const [links] = await pool.query('SELECT code, target, title, created_at, expires_at, max_clicks, (password_hash IS NOT NULL) AS is_protected, mobile_target FROM urls WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
        res.json(links);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
}
