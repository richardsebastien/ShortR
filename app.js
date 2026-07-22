import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import session from 'express-session';
import { runMigrations } from './db.js';

// Import routers
import authRouter from './routes/auth.routes.js';
import urlRouter from './routes/url.routes.js';
import statsRouter from './routes/stats.routes.js';
import redirectRouter from './routes/redirect.routes.js';

dotenv.config();

const app = express();

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
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

// Serve static files (public/index.html will be accessible at `/`)
app.use(express.static('public'));

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/stats-private', statsRouter);
app.use('/api', urlRouter);
// Mount redirection routes last because they contain the wildcard /:code
app.use('/', redirectRouter);

// Choose a safe port : ignore explicitly 80/443 and ports <1024
function pickPort() {
  const p = Number(process.env.PORT);
  if (Number.isFinite(p) && p >= 1024) return p;
  return 3000; // fallback value
}

const port = pickPort();

// Bind to 0.0.0.0 so Docker port mapping can expose the service to the host
app.listen(port, '0.0.0.0', () => {
  console.log(`URLR prêt (port interne ${port})`);
});
