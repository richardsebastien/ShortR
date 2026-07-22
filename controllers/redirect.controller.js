import { pool } from '../db.js';
import QRCode from 'qrcode';
import fetch from 'node-fetch';
import { getClientIp } from '../utils/ip.js';
import { isValidCode } from '../utils/validate.js';

export async function getQRCode(req, res) {
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
}

export function healthcheck(req, res) {
    res.json({ ok: true, at: new Date().toISOString() });
}

export async function resolveRedirect(req, res) {
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
            if (!req.session.unlockedLinks || !req.session.unlockedLinks[code]) {
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

            try {
                const r = await fetch('/api/unlock/${code}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await r.json();
                if (r.ok) {
                    window.location.reload();
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

        <a href="/${code}?preview=skip" class="skip-link">
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
                    window.location.href = '/${code}?preview=skip';
                });
            } else {
                btn.textContent = isFr ? 'Continuer dans ' + timeLeft + 's' : 'Continue in ' + timeLeft + 's';
            }
        }, 1000);
    </script>
</body>
</html>`);
        }

        // UTM and click logging
        const u = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
        const utm_source = u.searchParams.get('utm_source');
        const utm_medium = u.searchParams.get('utm_medium');
        const utm_campaign = u.searchParams.get('utm_campaign');

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
                console.error('Failed to log click', e);
            }
        })();

        return res.redirect(302, targetUrl);
    } catch (e) {
        console.error(e);
        return res.status(500).send('Server error');
    }
}
