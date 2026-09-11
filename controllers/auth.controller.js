import { pool } from '../db.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';

export async function register(req, res) {
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
}

export async function login(req, res) {
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
}

export function logout(req, res) {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
}

export function getStatus(req, res) {
    if (req.session.userId) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
}

export function getMe(req, res) {
    if (req.session.userId) {
        res.json({ userId: req.session.userId });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
}

export async function forgotPassword(req, res) {
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

        try {
            await transporter.sendMail(mailOptions);
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
}

export async function resetPassword(req, res) {
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
}
