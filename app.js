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
import fetch from 'node-fetch';

dotenv.config();

const app = express();

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


// Create a short URL
app.post('/api/shorten', createLimiter, async (req, res) => {
	try {
		// Accept the frontend payload: { target, customCode, title }
		const { target, customCode, title } = req.body || {};
		if (!target || !isValidUrl(target)) return res.status(400).json({ error: 'Invalid url' });

		let finalCode = customCode && isValidCode(customCode) ? customCode : nanoid(7);

		// Ensure unique code
		const [[existing]] = await pool.query('SELECT id FROM urls WHERE code = ?', [finalCode]);
		if (existing) {
			// try with generated code if custom collides
			if (customCode) return res.status(409).json({ error: 'Code already used' });
			finalCode = nanoid(8);
		}

		await pool.query('INSERT INTO urls (code, target, title, is_active, created_ip, user_id) VALUES (?, ?, ?, 1, ?, ?)', [
			finalCode,
			target,
			title || null,
			getClientIp(req),
            req.session.userId || null
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
        const [links] = await pool.query('SELECT code, target, title, created_at FROM urls WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
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

		const [[url]] = await pool.query('SELECT id, target, is_active FROM urls WHERE code = ?', [code]);
		if (!url || !url.is_active) return res.status(404).send('Not found');

		const ip = getClientIp(req);
		const ua = req.headers['user-agent'] || null;
		const ref = req.get('referer') || null;

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

		return res.redirect(302, url.target);
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


// ===== Fin stats publiques =====

// On peut lier sur localhost, Passenger reverse-proxy depuis Apache
const port = pickPort();
// Bind to 0.0.0.0 so Docker port mapping can expose the service to the host
app.listen(port, '0.0.0.0', () => {
  console.log(`URLR prêt (port interne ${port})`);
});
