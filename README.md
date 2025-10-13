# ShortR

A lightweight URL shortener with QR code generation and basic click tracking. This repository contains a small Node.js (Express) application and a MySQL database managed via Docker Compose (for development).

## Key Features

- **User Authentication**: Register and log in to manage your links.
- **Link Management**: Create, view, and manage your short links from a personal dashboard.
- **Custom Codes**: Use custom codes for your short links.
- **QR Codes**: Automatically generate a QR code for each link.
- **Detailed Statistics**: Track the performance of your links with private, detailed statistics, including:
  - Click counts (total, 24h, 7d, 30d)
  - Click timeline (clicks per day)
  - Top referrers
  - UTM campaign tracking
  - Geolocation of clicks on a world map

## Prerequisites

- Docker and docker-compose (Docker Desktop) — recommended
- Or Node.js (>= 16) if you want to run without Docker

## Getting Started with Docker Compose (recommended)

From the project root:

```powershell
# Build and start the services (DB + app)
docker compose up --build
```

The web service exposes port `3000` by default (see `docker-compose.yml`).

Access:

- Main UI: http://localhost:3000/
- Login: http://localhost:3000/login.html
- Register: http://localhost:3000/register.html

## Local Execution (without Docker)

1. Install dependencies:

```powershell
npm ci
```

2. Copy your environment variables (or create `.env`):

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=urlr
MYSQL_PASSWORD=changeme
MYSQL_DB=urlr
PUBLIC_BASE_URL=http://localhost:3000
PORT=3000
SESSION_SECRET=a-very-strong-and-long-random-string
ADMIN_TOKEN=change-this-admin-token
```

3. Start the application:

```powershell
npm run dev
```

> Note: for local execution without Docker, you must start a MySQL instance and import `sql/001_init.sql`.

## Environment Variables

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB` — Database connection details.
- `PUBLIC_BASE_URL` — The public base URL for generating short links (e.g., `https://example.com`).
- `PORT` — The port the application listens on (defaults to 3000).
- `SESSION_SECRET` — A long, random string used to secure user sessions. **This is mandatory.**
- `ADMIN_TOKEN` — An administration token (for future use).
- `TRUST_PROXY` — Set to `1` if the application is behind a reverse proxy (like nginx or Apache). This is important for securing cookies and identifying the client's IP address.

The Docker Compose project uses a `.env` file if present; check `docker-compose.yml`.

## Main Endpoints

### Public Endpoints
- `POST /api/shorten`
  - Creates a short link. If the user is authenticated, the link will be associated with their account.
  - **Payload**: `{ "target": "https://...", "customCode": "optional", "title": "optional" }`
  - **Response**: `{ "code", "shortUrl", "target", "qrUrl" }`
- `GET /:code`
  - Redirects to the target URL and logs the click.
- `GET /qr/:code.png`
  - Returns a PNG image of the QR code for the short link.
- `GET /health`
  - A simple healthcheck endpoint.

### Authentication Endpoints
- `POST /api/auth/register`
  - Registers a new user.
  - **Payload**: `{ "email": "...", "password": "..." }`
- `POST /api/auth/login`
  - Logs in a user and starts a session.
  - **Payload**: `{ "email": "...", "password": "..." }`
- `POST /api/auth/logout`
  - Logs out the current user.
- `GET /api/auth/status`
  - Checks if the current user is logged in.

### Private (Authenticated) Endpoints
- `GET /api/user/links`
  - Returns a list of all links created by the authenticated user.
- `GET /api/stats-private/:code`
  - Returns detailed statistics for a specific link owned by the user.
- `GET /api/stats-private/:code/map`
  - Returns geolocation data for clicks on a specific link, suitable for rendering a map.

Example (PowerShell) to create a link:

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/shorten -ContentType 'application/json' -Body '{"target":"https://www.google.com"}'
```

Or with curl:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"target":"https://www.google.com"}' http://localhost:3000/api/shorten
```

## Important Files

- `app.js` — Express server
- `db.js` — MySQL pool
- `sql/001_init.sql` — base schema (tables `urls`, `clicks`)
- `public/` — static files (UI)
- `docker-compose.yml` — Docker configuration

## Quick Troubleshooting

- If `docker compose up` fails: run `docker compose config` to validate the YAML file.
- If you get `Invalid URL` from the form: check that the frontend is sending `{ "target": "https://..." }` (the form field is named `target`).
- Client-side JavaScript errors: open the DevTools Console and note the file:line:column displayed.
- For HTML pattern issues (`input pattern`), the hyphen must be escaped within the character class (e.g., `[A-Za-z0-9_\-]{4,32}`).

## Quick Tests / Smoke Tests

- Check that the API is responding: `curl http://localhost:3000/health`
- Create a link and check the redirection:
  - POST `/api/shorten` then access the returned `shortUrl`

## Contribution

- Fork the repository, create a branch, make your changes, and open a MR.

## License

[CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

# © 2025 RICHARD Sébastien - All rights reserved