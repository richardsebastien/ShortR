import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { pool } from './db.js';
import { isValidUrl, isValidCode } from './utils/validate.js';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import { Parser } from 'json2csv';
import xlsx from 'xlsx';
import crypto from 'crypto';

dotenv.config();

function createUnlockToken(code) {
    const expires = Date.now() + 30000; // 30 seconds
    const data = `${code}:${expires}`;
    const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET)
                            .update(data)
                            .digest('hex');
    return `${expires}:${signature}`;
}

function verifyUnlockToken(code, token) {
    if (!token) return false;
    const parts = token.split(':');
    if (parts.length !== 2) return false;
    const [expiresStr, signature] = parts;
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || expires < Date.now()) return false;

    const data = `${code}:${expires}`;
    const expectedSignature = crypto.createHmac('sha256', process.env.SESSION_SECRET)
                                    .update(data)
                                    .digest('hex');
    return signature === expectedSignature;
}

const app = express();

// Self-healing database migration
async function runMigrations() {
    try {
        // Check if users table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log("Database tables do not exist yet. Skipping column check.");
            return;
        }

        // Check columns in users table
        const [columns] = await pool.query("SHOW COLUMNS FROM users");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('reset_token')) {
            console.log("Migrating database: Adding reset_token column to users table...");
            await pool.query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL");
        }
        if (!columnNames.includes('reset_token_expires')) {
            console.log("Migrating database: Adding reset_token_expires column to users table...");
            await pool.query("ALTER TABLE users ADD COLUMN reset_token_expires DATETIME NULL");
        }

        // Check columns in urls table
        const [urlColumns] = await pool.query("SHOW COLUMNS FROM urls");
        const urlColumnNames = urlColumns.map(c => c.Field);

        if (!urlColumnNames.includes('expires_at')) {
            console.log("Migrating database: Adding expires_at column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN expires_at DATETIME NULL");
        }
        if (!urlColumnNames.includes('max_clicks')) {
            console.log("Migrating database: Adding max_clicks column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN max_clicks INT UNSIGNED NULL");
        }
        if (!urlColumnNames.includes('password_hash')) {
            console.log("Migrating database: Adding password_hash column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN password_hash VARCHAR(255) NULL");
        }
        if (!urlColumnNames.includes('mobile_target')) {
            console.log("Migrating database: Adding mobile_target column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN mobile_target TEXT NULL");
        }

        console.log("Database migrations checked and up-to-date.");
    } catch (err) {
        console.error("Database migration check failed:", err);
    }
}

// Run migrations on startup
runMigrations();

app.use(express.json());
app.use(morgan('tiny'));
// If deployed behind a reverse proxy (like Apache/nginx on o2switch), enable trust proxy
// so that express knows the original protocol (req.secure) and express-session can set secure cookies correctly.
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
}
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  // Use sameSite=lax which works well for most auth flows and allows the cookie on top-level navigations
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// Servir les fichiers statiques (public/index.html sera accessible à `/`)
app.use(express.static('public'));

// Rate limiter for creation endpoint
const createLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
});

function getClientIp(req) {
	const xff = req.headers['x-forwarded-for'];
	if (xff) return String(xff).split(',')[0].trim();
	return req.socket.remoteAddress || null;
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 8) {
            return res.status(400).json({ error: 'Email and password (min 8 chars) are required' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already used' });
        }
        await pool.query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);
        res.status(201).json({ message: 'User created' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/links/:code', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
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
});

app.put('/api/links/:code', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
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
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const [[user]] = await pool.query('SELECT id, password_hash FROM users WHERE email = ?', [email]);
        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({ message: 'Logged in' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) {
        res.json({ userId: req.session.userId });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Forgot password / Request reset token
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const [[user]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const token = nanoid(32);
        // Expiration in 1 hour
        const expires = new Date(Date.now() + 3600000);
        await pool.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?', [token, expires, email]);

        const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${base}/reset-password.html?token=${token}`;

        // Configure dynamic transport
        let transporter;
        let fromEmail = process.env.SMTP_FROM || '"ShortR" <noreply@example.com>';

        const isSmtpConfigured = process.env.SMTP_USER &&
                                !process.env.SMTP_USER.includes('yourdomain') &&
                                process.env.SMTP_HOST &&
                                !process.env.SMTP_HOST.includes('yourdomain');

        if (isSmtpConfigured) {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: Number(process.env.SMTP_PORT) === 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        } else {
            // Local fallback SMTP (for o2switch out-of-the-box local mailing on port 25 without credentials)
            transporter = nodemailer.createTransport({
                host: 'localhost',
                port: 25,
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Dynamically derive a valid sender email for o2switch using the request hostname
            const host = req.get('host') || 'localhost';
            const domain = host.split(':')[0];
            fromEmail = `"ShortR" <noreply@${domain}>`;
        }

        // Prepare email content
        const mailOptions = {
            from: fromEmail,
            to: email,
            subject: 'Réinitialisation de votre mot de passe - ShortR',
            text: `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe pour votre compte ShortR.\n\nVeuillez cliquer sur le lien ci-dessous pour réinitialiser votre mot de passe (ce lien est valable pendant 1 heure) :\n\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.\n\nL'équipe ShortR`,
            html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            background-color: #0b1020;
            color: #e6ebff;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            text-align: center;
        }
        .logo-img {
            max-width: 180px;
            height: auto;
            margin-bottom: 30px;
        }
        .card {
            background-color: #0e1533;
            border: 1px solid #2b3355;
            border-radius: 12px;
            padding: 30px;
            text-align: left;
        }
        h1 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-top: 0;
            margin-bottom: 20px;
            color: #e6ebff;
        }
        .btn {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: bold;
            font-size: 16px;
            margin-top: 10px;
            margin-bottom: 20px;
        }
        .btn:hover {
            background-color: #2563eb;
        }
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #888888;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="cid:logo" alt="ShortR Logo" class="logo-img">
        <div class="card">
            <h1>Réinitialisation de votre mot de passe</h1>
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ShortR.</p>
            <p>Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe (ce lien est valable pendant 1 heure) :</p>
            <div style="text-align: center;">
                <a href="${resetLink}" class="btn">Réinitialiser mon mot de passe</a>
            </div>
            <p style="font-size: 14px; color: #888888; word-break: break-all;">
                Si le bouton ne fonctionne pas, copiez-collez le lien suivant dans votre navigateur :<br>
                <a href="${resetLink}" style="color: #3b82f6;">${resetLink}</a>
            </p>
            <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
        </div>
        <div class="footer">
            <p>© 2025 ShortR - Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>`,
            attachments: [{
                filename: 'logo.png',
                path: 'public/logo.png',
                cid: 'logo'
            }]
        };

        let emailSent = false;

        try {
            await transporter.sendMail(mailOptions);
            emailSent = true;
            console.log(`Password reset email sent successfully to ${email}`);
        } catch (mailError) {
            console.error(`Failed to send password reset email to ${email}:`, mailError);
        }

        // Always fallback log for development verification
        console.log(`[DEVELOPMENT FALLBACK] Password reset requested for ${email}. Link: ${resetLink}`);

        // Return a secure response (NO resetLink or token)
        res.json({ message: 'If this email is registered, a reset link has been sent.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset password using token
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password || password.length < 8) {
            return res.status(400).json({ error: 'Token and password (min 8 chars) are required' });
        }
        const [[user]] = await pool.query('SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [passwordHash, user.id]);
        res.json({ message: 'Password reset successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});


app.post('/api/unlock/:code', async (req, res) => {
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

        if (req.body.refusedCookies) {
            const token = createUnlockToken(code);
            return res.json({ success: true, message: 'Link unlocked (stateless)', token });
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
});

// Create a short URL
app.post('/api/shorten', createLimiter, async (req, res) => {
	try {
		// Accept the frontend payload: { target, customCode, title, expiresAt, maxClicks, password, mobileTarget }
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
			// try with generated code if custom collides
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
});

// QR Code PNG
app.get('/qr/:code.png', async (req, res) => {
	try {
		const { code } = req.params;
		if (!isValidCode(code)) return res.status(400).send('Bad code');

		const [[url]] = await pool.query('SELECT code FROM urls WHERE code = ? AND is_active = 1', [code]);
		if (!url) return res.status(404).send('Not found');

		const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || '';
		const shortUrl = `${base}/${code}`;

		const buf = await QRCode.toBuffer(shortUrl, {
			type: 'png',
			errorCorrectionLevel: 'M',
			margin: 1,
			scale: 6,
		});

		res.setHeader('Content-Type', 'image/png');
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		return res.send(buf);
	} catch (e) {
		console.error(e);
		return res.status(500).send('Server error');
	}
});

// User links
app.get('/api/user/links', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const [links] = await pool.query('SELECT code, target, title, created_at, expires_at, max_clicks, (password_hash IS NOT NULL) AS is_protected, mobile_target FROM urls WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
        res.json(links);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, at: new Date().toISOString() }));

// Redirection + logging
app.get('/:code', async (req, res) => {
	try {
		const { code } = req.params;
		if (!isValidCode(code)) return res.status(404).send('Not found');

		const [[url]] = await pool.query('SELECT id, target, is_active, expires_at, max_clicks, password_hash, mobile_target FROM urls WHERE code = ?', [code]);
		if (!url || !url.is_active) return res.status(404).send('Not found');

		let expired = false;
		if (url.expires_at && new Date(url.expires_at) < new Date()) {
			expired = true;
		}

		if (!expired && url.max_clicks !== null) {
			const [[{ clickCount }]] = await pool.query('SELECT COUNT(*) AS clickCount FROM clicks WHERE url_id = ?', [url.id]);
			if (clickCount >= url.max_clicks) {
				expired = true;
			}
		}

		if (expired) {
			const acceptLang = req.headers['accept-language'] || '';
			const isFrench = acceptLang.toLowerCase().includes('fr');
			res.status(410); // Gone status code is perfect for expired links
			return res.send(`<!DOCTYPE html>
<html lang="${isFrench ? 'fr' : 'en'}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isFrench ? 'Lien expiré - ShortR' : 'Link expired - ShortR'}</title>
    <style>
        body {
            background-color: #0b1020;
            color: #e6ebff;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            width: 90%;
            text-align: center;
            padding: 40px 20px;
            background-color: #0e1533;
            border: 1px solid #2b3355;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .logo-img {
            max-width: 150px;
            height: auto;
            margin-bottom: 24px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 16px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-top: 0;
            margin-bottom: 24px;
            color: #a5b4fc;
        }
        .btn {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: bold;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background-color: #2563eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="/logo.png" alt="ShortR Logo" class="logo-img">
        <h1>${isFrench ? 'Ce lien a expiré' : 'This link has expired'}</h1>
        <p>
            ${isFrench
                ? "Désolé, ce lien de redirection n'est plus disponible car il a atteint sa date de validité ou sa limite maximale de clics."
                : "Sorry, this redirection link is no longer available because it has reached its expiration date or maximum click limit."}
        </p>
        <a href="/" class="btn">${isFrench ? 'Créer mon propre lien' : 'Create my own link'}</a>
    </div>
</body>
</html>`);
		}

		// Check password protection
		if (url.password_hash) {
			const hasToken = req.query.token && verifyUnlockToken(code, req.query.token);
			if (!hasToken && (!req.session.unlockedLinks || !req.session.unlockedLinks[code])) {
				const acceptLang = req.headers['accept-language'] || '';
				const isFrench = acceptLang.toLowerCase().includes('fr');
				return res.send(`<!DOCTYPE html>
<html lang="${isFrench ? 'fr' : 'en'}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isFrench ? 'Lien Protégé - ShortR' : 'Protected Link - ShortR'}</title>
    <style>
        body {
            background-color: #0b1020;
            color: #e6ebff;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            max-width: 450px;
            width: 90%;
            text-align: center;
            padding: 40px 30px;
            background-color: #0e1533;
            border: 1px solid #2b3355;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .logo-img {
            max-width: 150px;
            height: auto;
            margin-bottom: 24px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 12px;
        }
        p {
            font-size: 15px;
            line-height: 1.5;
            margin-top: 0;
            margin-bottom: 24px;
            color: #a5b4fc;
        }
        .form-group {
            text-align: left;
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-size: 14px;
            margin-bottom: 8px;
            color: #e6ebff;
            opacity: 0.9;
        }
        input[type="password"] {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid #2b3355;
            background: #0b1020;
            color: #e6ebff;
            box-sizing: border-box;
            font-size: 16px;
        }
        input[type="password"]:focus {
            border-color: #3b82f6;
            outline: none;
        }
        .btn {
            width: 100%;
            padding: 12px 16px;
            border: 0;
            border-radius: 10px;
            background: #3b82f6;
            color: #ffffff !important;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            text-decoration: none;
            display: inline-block;
            box-sizing: border-box;
        }
        .btn:hover {
            background-color: #2563eb;
        }
        .error-msg {
            color: #f87171;
            font-size: 14px;
            margin-top: 12px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="/logo.png" alt="ShortR Logo" class="logo-img">
        <h1>${isFrench ? 'Lien protégé' : 'Protected link'}</h1>
        <p>
            ${isFrench
                ? "Ce lien est sécurisé par un mot de passe. Veuillez le saisir pour continuer."
                : "This link is secured by a password. Please enter it to continue."}
        </p>
        <form id="unlock-form">
            <div class="form-group">
                <label for="password">${isFrench ? 'Mot de passe' : 'Password'}</label>
                <input type="password" id="password" required placeholder="••••••••">
            </div>
            <button type="submit" class="btn">${isFrench ? 'Déverrouiller' : 'Unlock'}</button>
            <div id="error" class="error-msg"></div>
        </form>
    </div>

    <script>
        document.getElementById('unlock-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            errorDiv.style.display = 'none';

            const refusedCookies = localStorage.getItem('cookieConsent') === 'refused';

            try {
                const r = await fetch('/api/unlock/${code}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, refusedCookies })
                });
                const data = await r.json();
                if (r.ok) {
                    if (data.token) {
                        window.location.href = '/${code}?token=' + data.token;
                    } else {
                        window.location.reload();
                    }
                } else {
                    errorDiv.textContent = data.error || '${isFrench ? "Erreur" : "Error"}';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = '${isFrench ? "Erreur de connexion" : "Connection error"}';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>`);
			}
		}

		const ip = getClientIp(req);
		const ua = req.headers['user-agent'] || null;
		const ref = req.get('referer') || null;

		let targetUrl = url.target;
		if (url.mobile_target) {
			const isMobile = /mobile|android|iphone|ipad|ipod|phone/i.test(ua || '');
			if (isMobile) {
				targetUrl = url.mobile_target;
			}
		}

		if (req.query.preview !== 'skip') {
			const acceptLang = req.headers['accept-language'] || '';
			const isFrench = acceptLang.toLowerCase().includes('fr');
			return res.send(`<!DOCTYPE html>
<html lang="${isFrench ? 'fr' : 'en'}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isFrench ? 'Avertissement de sécurité - ShortR' : 'Security Warning - ShortR'}</title>
    <style>
        body {
            background-color: #0b1020;
            color: #e6ebff;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            width: 90%;
            text-align: center;
            padding: 40px 30px;
            background-color: #0e1533;
            border: 1px solid #2b3355;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            box-sizing: border-box;
        }
        .logo-img {
            max-width: 150px;
            height: auto;
            margin-bottom: 24px;
        }
        .warning-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 12px;
        }
        p {
            font-size: 15px;
            line-height: 1.5;
            margin-top: 0;
            margin-bottom: 20px;
            color: #a5b4fc;
        }
        .url-box {
            background-color: #0b1020;
            border: 1px solid #2b3355;
            border-radius: 10px;
            padding: 14px;
            word-break: break-all;
            font-family: monospace;
            font-size: 14px;
            color: #60a5fa;
            margin-bottom: 24px;
            text-align: left;
        }
        .btn {
            width: 100%;
            padding: 12px 16px;
            border: 0;
            border-radius: 10px;
            background: #3b82f6;
            color: #ffffff !important;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
            text-decoration: none;
            display: inline-block;
            box-sizing: border-box;
        }
        .btn:hover {
            background-color: #2563eb;
        }
        .btn:disabled {
            background-color: #1d2440;
            color: #64748b !important;
            cursor: not-allowed;
        }
        .skip-link {
            display: inline-block;
            margin-top: 16px;
            color: #888888;
            font-size: 13px;
            text-decoration: none;
            transition: color 0.2s;
        }
        .skip-link:hover {
            color: #ffffff;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="/logo.png" alt="ShortR Logo" class="logo-img">
        <div class="warning-icon">⚠️</div>
        <h1>${isFrench ? 'Avertissement de redirection' : 'Redirection Warning'}</h1>
        <p>
            ${isFrench
                ? "Vous quittez ShortR pour vous rendre sur le site externe suivant. Assurez-vous d'avoir confiance en cette URL avant de continuer :"
                : "You are leaving ShortR to go to the following external site. Make sure you trust this URL before proceeding:"}
        </p>
        <div class="url-box">${targetUrl}</div>

        <button id="continue-btn" class="btn" disabled>
            ${isFrench ? 'Continuer dans 5s' : 'Continue in 5s'}
        </button>

        <a href="/${code}?preview=skip${req.query.token ? '&token=' + req.query.token : ''}" class="skip-link">
            ${isFrench ? 'Passer le compte à rebours et continuer immédiatement' : 'Skip countdown and continue immediately'}
        </a>
    </div>

    <script>
        let timeLeft = 5;
        const btn = document.getElementById('continue-btn');
        const isFr = ${isFrench};

        const interval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(interval);
                btn.removeAttribute('disabled');
                btn.textContent = isFr ? 'Continuer' : 'Continue';
                btn.addEventListener('click', () => {
                    window.location.href = '/${code}?preview=skip${req.query.token ? '&token=' + req.query.token : ''}';
                });
            } else {
                btn.textContent = isFr ? 'Continuer dans ' + timeLeft + 's' : 'Continue in ' + timeLeft + 's';
            }
        }, 1000);
    </script>
</body>
</html>`);
		}

		// UTM depuis la requête actuelle (si présents)
		const u = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
		const utm_source = u.searchParams.get('utm_source');
		const utm_medium = u.searchParams.get('utm_medium');
		const utm_campaign = u.searchParams.get('utm_campaign');

		// On loggue de façon asynchrone sans bloquer la redirection
		(async () => {
			try {
				let countryCode = null, lat = null, lon = null;

				// Localhost IPs for testing
				const localIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
				if (ip && !localIPs.includes(ip)) {
					const geo = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,lat,lon`).then(r => r.json());
					if (geo && geo.status === 'success') {
						countryCode = geo.countryCode;
						lat = geo.lat;
						lon = geo.lon;
					}
				}

				await pool.query(
					'INSERT INTO clicks (url_id, ip, user_agent, referrer, utm_source, utm_medium, utm_campaign, country_code, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
					[url.id, ip, ua, ref, utm_source, utm_medium, utm_campaign, countryCode, lat, lon]
				);
			} catch (e) {
				console.error('Failed to log click', e)
			}
		})();

		return res.redirect(302, targetUrl);
	} catch (e) {
		console.error(e);
		return res.status(500).send('Server error');
	}
});

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, at: new Date().toISOString() }));

// Choisit un port sûr : on ignore explicitement 80/443 et ports <1024
function pickPort() {
  const p = Number(process.env.PORT);
  if (Number.isFinite(p) && p >= 1024) return p;
  return 3000; // valeur de secours
}

// ===== Stats privées (pour l'utilisateur connecté) =====
app.get('/api/stats-private/:code', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { code } = req.params;
        const [[url]] = await pool.query(
            'SELECT id, code, target, title, is_active, created_at, user_id FROM urls WHERE code = ?',
            [code]
        );

        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // The rest is the same as the public stats endpoint.
        // Totaux
        const [[{ total }]]     = await pool.query('SELECT COUNT(*) AS total FROM clicks WHERE url_id = ?', [url.id]);
        const [[{ total24h }]]  = await pool.query('SELECT COUNT(*) AS total24h FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 1 DAY', [url.id]);
        const [[{ total7d }]]   = await pool.query('SELECT COUNT(*) AS total7d FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 7 DAY', [url.id]);
        const [[{ total30d }]]  = await pool.query('SELECT COUNT(*) AS total30d FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 30 DAY', [url.id]);

        // Timeline 30 jours (par jour)
        const [timeline] = await pool.query(
          `SELECT DATE(ts) AS d, COUNT(*) AS c
           FROM clicks
           WHERE url_id = ? AND ts >= CURDATE() - INTERVAL 30 DAY
           GROUP BY DATE(ts)
           ORDER BY d`,
          [url.id]
        );

        // Top referrers (direct si NULL/vide)
        const [referrers] = await pool.query(
          `SELECT COALESCE(NULLIF(referrer,''), '(direct)') AS ref, COUNT(*) AS c
           FROM clicks
           WHERE url_id = ?
           GROUP BY ref
           ORDER BY c DESC
           LIMIT 10`,
          [url.id]
        );

        // Top combinaisons UTM
        const [utm] = await pool.query(
          `SELECT
             COALESCE(utm_source,'')   AS source,
             COALESCE(utm_medium,'')   AS medium,
             COALESCE(utm_campaign,'') AS campaign,
             COUNT(*) AS c
           FROM clicks
           WHERE url_id = ?
           GROUP BY source, medium, campaign
           ORDER BY c DESC
           LIMIT 10`,
          [url.id]
        );

        // 20 derniers clics "safe"
        const [recent] = await pool.query(
          `SELECT
             ts,
             LEFT(COALESCE(referrer,''), 200)   AS referrer,
             LEFT(COALESCE(utm_source,''), 60)  AS utm_source,
             LEFT(COALESCE(utm_medium,''), 60)  AS utm_medium,
             LEFT(COALESCE(utm_campaign,''), 60)AS utm_campaign
           FROM clicks
           WHERE url_id = ?
           ORDER BY id DESC
           LIMIT 20`,
          [url.id]
        );

        res.json({
            ok: true,
            url: {
                code: url.code,
                title: url.title,
                target: url.target,
                is_active: !!url.is_active,
                created_at: url.created_at
            },
            totals: { all: total, last24h: total24h, last7d: total7d, last30d: total30d },
            timeline,
            referrers,
            utm,
            recent
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/stats-private/:code/map', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const { code } = req.params;
        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);
        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }
        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [locations] = await pool.query(
            `SELECT country_code, lat, lon, COUNT(*) as count
             FROM clicks
             WHERE url_id = ? AND country_code IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL
             GROUP BY country_code, lat, lon`,
            [url.id]
        );
        res.json(locations);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generic export function
async function handleExport(req, res, format) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { code } = req.params;
        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);

        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [clicks] = await pool.query('SELECT * FROM clicks WHERE url_id = ? ORDER BY ts DESC', [url.id]);

        if (format === 'csv') {
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(clicks);
            res.header('Content-Type', 'text/csv');
            res.attachment(`${code}-stats.csv`);
            res.send(csv);
        } else if (format === 'xlsx') {
            const worksheet = xlsx.utils.json_to_sheet(clicks);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Clicks');
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment(`${code}-stats.xlsx`);
            res.send(buffer);
        }
    } catch (e) {
        console.error(`Error exporting ${format}:`, e);
        res.status(500).json({ error: 'Server error during export' });
    }
}

app.get('/api/stats-private/:code/export/csv', (req, res) => handleExport(req, res, 'csv'));
app.get('/api/stats-private/:code/export/xlsx', (req, res) => handleExport(req, res, 'xlsx'));


// ===== Fin stats publiques =====

// On peut lier sur localhost, Passenger reverse-proxy depuis Apache
const port = pickPort();
// Bind to 0.0.0.0 so Docker port mapping can expose the service to the host
app.listen(port, '0.0.0.0', () => {
  console.log(`URLR prêt (port interne ${port})`);
});
