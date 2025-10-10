# ShortR

Raccourcisseur d'URL léger avec génération de QR et suivi basique (clicks). Ce dépôt contient une petite application Node.js (Express) et une base MySQL gérée via Docker Compose (pour le développement).

## Principales fonctionnalités

- Créer un lien court (URL cible, code personnalisé optionnel, titre)
- Redirection via `/:code`
- Image QR pour chaque code (`/qr/:code.png`)
- Page statiques (UI) : `/` pour l'interface principale, `/stats.html` pour les statistiques publiques
- API publique pour récupérer les stats d'un code

## Prérequis

- Docker et docker-compose (Docker Desktop) — recommandé
- Ou Node.js (>= 16) si vous souhaitez exécuter sans Docker

## Démarrage avec Docker Compose (recommandé)

Depuis la racine du projet :

```powershell
# Build et démarre les services (DB + app)
docker compose up --build
```

Le service web expose par défaut le port `3000` (voir `docker-compose.yml`).

Accès :

- UI principale : http://localhost:3000/
- Page stats : http://localhost:3000/stats.html

## Exécution locale (sans Docker)

1. Installer les dépendances :

```powershell
npm ci
```

2. Copier vos variables d'environnement (ou créer `.env`) :

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=urlr
MYSQL_PASSWORD=changeme
MYSQL_DB=urlr
PUBLIC_BASE_URL=http://localhost:3000
PORT=3000
ADMIN_TOKEN=change-this-admin-token
```

3. Démarrer l'application :

```powershell
npm run dev
```

> Note : en local sans Docker vous devez démarrer une instance MySQL et importer `sql/001_init.sql`.

## Variables d'environnement

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB` — connexion à la base
- `PUBLIC_BASE_URL` — URL publique utilisée pour générer les liens courts (ex. `https://example.com`)
- `PORT` — port d'écoute de l'application (par défaut 3000)
- `ADMIN_TOKEN` — token d'administration (utilisation future)

Le projet Docker Compose utilise un fichier `.env` si présent; vérifiez `docker-compose.yml`.

## Endpoints principaux

- POST `/api/shorten`

  - Payload JSON attendu : `{ "target": "https://...", "customCode": "opt", "title": "opt" }`
  - Réponse : `{ code, shortUrl, target, qrUrl }`

- GET `/:code` — redirige vers la cible enregistrée
- GET `/qr/:code.png` — retourne une image PNG du QR code
- GET `/api/stats-public/:code` — retourne les statistiques publiques (totaux, timeline, top referrers, utm, recent)
- GET `/health` — healthcheck simple

Exemple (PowerShell) pour créer un lien :

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/shorten -ContentType 'application/json' -Body '{"target":"https://www.google.com"}'
```

Ou avec curl :

```bash
curl -X POST -H "Content-Type: application/json" -d '{"target":"https://www.google.com"}' http://localhost:3000/api/shorten
```

## Fichiers importants

- `app.js` — serveur Express
- `db.js` — pool MySQL
- `sql/001_init.sql` — schéma de base (tables `urls`, `clicks`)
- `public/` — fichiers statiques (UI)
- `docker-compose.yml` — configuration Docker

## Dépannage rapide

- Si `docker compose up` échoue : lancez `docker compose config` pour valider le fichier YAML.
- Si vous obtenez `Invalid URL` depuis le formulaire : vérifiez que le frontend envoie `{ "target": "https://..." }` (le champ du formulaire s'appelle `target`).
- Erreurs JavaScript côté client : ouvrez la Console DevTools et notez le fichier:ligne:colonne affiché.
- Pour les problèmes de pattern HTML (`input pattern`), le tiret doit être échappé dans la classe de caractères (ex. `[A-Za-z0-9_\-]{4,32}`).

## Tests rapides / smoke tests

- Vérifier que l'API répond : `curl http://localhost:3000/health`
- Créer un lien et vérifier la redirection :
  - POST `/api/shorten` puis accéder au `shortUrl` renvoyé

## Contribution

- Forkez le dépôt, créez une branche, faites vos changements et ouvrez une MR.

## Licence

[CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

# © 2025 RICHARD Sébastien - Tous droits réservés
