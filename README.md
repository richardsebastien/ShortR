# ShortR - Réducteur d'URL Moderne & Intuitif
[ShortR.fr](https://shortr.fr/)

**ShortR** est une application web moderne de réduction d'URL, conçue pour être légère, sécurisée et extrêmement complète. Développée avec **Node.js (Express)** et **MySQL**, elle offre une panoplie de fonctionnalités avancées de ciblage, de protection et d'analyse de données, tout en restant facile à déployer en local ou via Docker Compose.

---

## 🚀 Fonctionnalités Clés

### 1. Gestion des Liens & Raccourcissement Avancé
* **Raccourcissement ultra-rapide** : Créez des liens courts en un clic à partir d'une URL cible.
* **Codes personnalisés** : Définissez votre propre code personnalisé pour vos liens (ex: `shortr.fr/mon-lien`).
* **Génération de QR Codes** : Chaque lien raccourci génère automatiquement un QR code haute résolution au format PNG téléchargeable et partageable.
* **Titres personnalisés** : Attribuez des titres à vos liens pour mieux les organiser dans votre tableau de bord.

### 2. Paramètres Avancés de Redirection (Ciblage & Éphémérité)
* **Date d'expiration** : Planifiez une date et heure au-delà desquelles le lien ne sera plus actif.
* **Limite maximale de clics** : Désactivez automatiquement le lien après un nombre défini de visites.
* **Protection par mot de passe** : Sécurisez l'accès à votre lien cible. Les visiteurs devront saisir le mot de passe sur une interface dédiée pour être redirigés.
* **Ciblage par appareil (Mobile)** : Définissez une URL cible alternative spécifique pour les utilisateurs sur appareils mobiles (iOS/Android).

### 3. Statistiques Privées & Analytique Avancée
Chaque utilisateur connecté dispose d'un accès exclusif et sécurisé aux statistiques détaillées de ses liens raccourcis :
* **Vue d'ensemble temporelle** : Visualisation du trafic avec le nombre total de clics et des filtres de période (Dernières 24 heures, 7 derniers jours, 30 derniers jours).
* **Graphique d'évolution** : Chronologie interactive des clics sur les 30 derniers jours.
* **Géolocalisation sur carte interactive** : Visualisez l'origine géographique des visiteurs sur une carte du monde dynamique propulsée par **Leaflet.js** et **ip-api.com** (récupérant de manière asynchrone le pays, la latitude et la longitude des clics).
* **Analyse des Référents (Referrers)** : Identifiez d'où proviennent vos visiteurs (sites tiers, réseaux sociaux, ou accès direct).
* **Suivi des campagnes UTM** : Analyse automatique des paramètres de tracking marketing (`utm_source`, `utm_medium`, `utm_campaign`).
* **Journal des clics récents** : Historique des derniers clics avec détails d'accès sécurisés (tronqués pour la confidentialité).
* **Exportation de données** : Téléchargez l'intégralité des données d'analyse au format **Excel (.xlsx)** ou **CSV** d'un simple clic pour vos rapports externes.

### 4. Expérience Utilisateur Moderne & Multilingue
* **Design Responsive & Thème Sombre** : Interface utilisateur épurée et moderne, adaptée à tous les écrans (ordinateurs, tablettes, smartphones).
* **Sélectionneur de thèmes (Sombre/Clair)** : Un interrupteur à glissière Lune/Soleil personnalisé et animé dans la barre de navigation permet de basculer instantanément de thème.
* **Support Bilingue (Français & Anglais)** : Détection automatique de la langue du navigateur et possibilité de changer à tout moment grâce à un sélecteur à drapeaux intégré dans la barre de navigation.
* **Sauvegarde des préférences** : La langue et le thème choisis sont mémorisés localement via `localStorage` pour vos prochaines visites.
* **Bannière de consentement** : Une bannière d'information sur les cookies s'affiche pour respecter la confidentialité et la gestion des préférences.

### 5. Sécurité & Confidentialité
* **Page de redirection intermédiaire obligatoire** : Pour protéger la vie privée et garantir la sécurité des utilisateurs, un écran d'avertissement avec un compte à rebours de 5 secondes s'affiche avant la redirection, montrant clairement l'URL de destination. Les utilisateurs pressés peuvent choisir de passer le compte à rebours.
* **Pages d'erreur thématiques** : Lorsqu'un lien expire (par date ou limite de clics), une page d'erreur dédiée bilingue avec le code HTTP **410 Gone** s'affiche.
* **Limitation du taux de requêtes (Rate Limiting)** : Protection intégrée contre le spam de création de liens via `express-rate-limit`.

---

## 🛠️ Architecture Technique

### Authentification & Sécurité
* Authentification complète par session sécurisée (`express-session`) avec chiffrement robuste des mots de passe via `bcryptjs`.
* Gestion de session robuste gérant l'attribut `sameSite` et les environnements de production sécurisés (HTTPS).

### Flux de Réinitialisation de Mot de Passe
* **Génération de jeton sécurisé** : Crée un jeton d'une durée de validité limitée à 1 heure.
* **E-mails d'une grande élégance** : Envoi de courriels au format HTML soigné reprenant la charte graphique de ShortR (thème sombre, bouton d'action et logo intégré en pièce jointe CID inline).
* **Mécanisme d'envoi flexible et résilient** :
  - Utilise les variables SMTP définies dans le fichier `.env` si elles sont présentes.
  - **Fallback automatique** : En cas d'absence de configuration SMTP (idéal pour le développement ou sur des hébergements comme *o2switch*), le système utilise un agent de transfert de mail (MTA) local sur `localhost:25` sans authentification en dérivant dynamiquement un expéditeur valide à partir du nom d'hôte de la requête courante.
  - **Fallback console** : Le lien de réinitialisation est toujours affiché dans la console du serveur à des fins de test et de débogage.

### Base de données "Self-Healing"
ShortR dispose d'un mécanisme de migration automatique et résilient au démarrage (`runMigrations` dans `app.js`). L'application vérifie la présence des tables et injecte dynamiquement les colonnes manquantes (telles que `reset_token`, `reset_token_expires`, `expires_at`, `max_clicks`, `password_hash`, `mobile_target`, etc.) dans votre base de données MySQL sans perturber les données existantes.

---

## ⚙️ Variables d'Environnement

Créez un fichier `.env` à la racine du projet en vous basant sur `.env.example` :

| Variable | Description | Valeur par défaut / Exemple |
| :--- | :--- | :--- |
| `PORT` | Port d'écoute du serveur Node.js (supérieur ou égal à 1024). | `3000` |
| `PUBLIC_BASE_URL` | URL publique de l'application (utilisée pour générer les liens courts et QR codes). | `http://localhost:3000` |
| `SESSION_SECRET` | Chaîne de caractères aléatoire et longue pour sécuriser les sessions utilisateur. **(Requis)** | `un-secret-tres-robuste-et-long` |
| `TRUST_PROXY` | À définir sur `1` si l'application est derrière un reverse proxy (Nginx, Apache, etc.). | `0` |
| `MYSQL_HOST` | Hôte de la base de données MySQL. | `127.0.0.1` ou `db` (Docker) |
| `MYSQL_PORT` | Port de la base de données MySQL. | `3306` |
| `MYSQL_USER` | Utilisateur de la base de données. | `urlr` |
| `MYSQL_PASSWORD` | Mot de passe de la base de données. | `changeme` |
| `MYSQL_DB` | Nom de la base de données. | `urlr` |
| `ADMIN_TOKEN` | Jeton d'administration (pour de futurs usages d'API). | `votre-jeton-admin` |
| `SMTP_HOST` | Hôte du serveur SMTP d'envoi d'e-mails. | `smtp.example.com` |
| `SMTP_PORT` | Port du serveur SMTP (généralement 587 ou 465). | `587` |
| `SMTP_USER` | Identifiant de connexion SMTP. | `noreply@example.com` |
| `SMTP_PASS` | Mot de passe SMTP. | `votre-mot-de-passe` |
| `SMTP_FROM` | Adresse e-mail d'expédition affichée. | `"ShortR" <noreply@example.com>` |

---

## 📦 Installation et Démarrage

### Option A : Avec Docker Compose (Recommandé pour le développement)

Docker Compose configure automatiquement le serveur Node.js et une base de données MySQL pré-configurée avec les scripts d'initialisation.

1. **Lancez les services** :
   ```bash
   docker compose up --build
   ```
2. **Accédez à l'application** :
   - Accueil / Raccourcisseur : [http://localhost:3000/](http://localhost:3000/)
   - Connexion : [http://localhost:3000/login.html](http://localhost:3000/login.html)
   - Inscription : [http://localhost:3000/register.html](http://localhost:3000/register.html)

### Option B : Installation Locale (sans Docker)

#### Prérequis
* Node.js (version 16 ou supérieure)
* Une instance de base de données MySQL active

#### Procédure
1. **Importez le schéma initial** :
   Importez le script SQL initial situé dans `sql/001_init.sql` dans votre serveur de base de données MySQL pour initialiser les structures de base.
2. **Installez les dépendances** :
   ```bash
   npm install
   ```
3. **Configurez l'environnement** :
   Copiez `.env.example` vers `.env` et ajustez les accès de connexion à votre base de données MySQL ainsi que votre `SESSION_SECRET`.
4. **Démarrez l'application** :
   ```bash
   npm run dev
   ```

---

## 🧪 Tests & Vérification

### Tests de fonctionnement rapide (Smoke Tests)
* Vérifier que le serveur répond correctement sur l'endpoint de santé :
  ```bash
  curl http://localhost:3000/health
  ```
* Raccourcir un lien via l'API publique en ligne de commande :
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"target":"https://www.google.com"}' http://localhost:3000/api/shorten
  ```

---

## 📄 Licence et Crédits

Ce projet est publié sous licence [CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/).

© 2025 RICHARD Sébastien - Tous droits réservés.
