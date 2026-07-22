# Déploiement de ShortR sur l'Hébergement o2switch

Ce guide explique étape par étape comment déployer **ShortR** sur un hébergement mutualisé **o2switch** en utilisant l'outil **"Inscrire une application Node.js"** de cPanel et une base de données **MySQL**.

---

## 📋 Prérequis

1. Un compte d'hébergement actif chez **o2switch**.
2. Un nom de domaine ou sous-domaine configuré et pointant vers votre hébergement (ex: `shortr.mon-domaine.fr`).
3. Un accès à l'interface d'administration **cPanel**.

---

## 🛠️ Étape 1 : Création de la Base de Données MySQL

1. Connectez-vous à votre **cPanel**.
2. Allez dans la section **Bases de données** > **Bases de données MySQL®**.
3. **Créer une nouvelle base de données** (ex: `prefixe_shortr`).
4. **Créer un nouvel utilisateur MySQL** avec un mot de passe fort (ex: `prefixe_shortr_user`). Mémorisez bien ce mot de passe.
5. **Ajouter l'utilisateur à la base de données** en lui cochant **Tous les privilèges**.
6. Allez dans **phpMyAdmin** depuis cPanel, sélectionnez la base de données que vous venez de créer, et importez le script d'initialisation de base situé dans le dossier `sql/001_init.sql` du projet.
   *(Note : Les migrations ultérieures et colonnes manquantes seront automatiquement créées par le mécanisme de Self-Healing au premier démarrage de l'application !)*

---

## 📁 Étape 2 : Téléchargement des Fichiers sur l'Hébergement

1. Compressez l'ensemble des fichiers du projet ShortR dans une archive `.zip` (excluez le dossier `node_modules` et le fichier `.env` s'ils existent localement).
2. Dans cPanel, ouvrez le **Gestionnaire de fichiers**.
3. Créez un dossier dédié à l'application en dehors du dossier `public_html` pour plus de sécurité (ex: `/home/votre_utilisateur/apps/shortr/`).
4. Téléversez l'archive `.zip` dans ce dossier et extrayez-la.

---

## ⚙️ Étape 3 : Configuration du Fichier `.env`

1. Dans le dossier de votre application (`/home/votre_utilisateur/apps/shortr/`), créez un fichier nommé `.env`.
2. Copiez-y le contenu de `.env.example` et adaptez les valeurs avec vos configurations de production :
   ```env
   PORT=3000
   PUBLIC_BASE_URL=https://shortr.mon-domaine.fr
   SESSION_SECRET=un-secret-tres-robuste-et-long-de-production
   TRUST_PROXY=1

   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=prefixe_shortr_user
   MYSQL_PASSWORD=votre_mot_de_passe_mysql
   MYSQL_DB=prefixe_shortr
   ```
3. *Note sur la messagerie (SMTP / Réinitialisation de mot de passe)* :
   Sur o2switch, si vous n'avez pas de serveur SMTP externe configuré, ShortR utilise un **fallback automatique**. Il enverra des e-mails via le MTA local sur `localhost:25` sans authentification en dérivant l'expéditeur de manière dynamique à partir du nom d'hôte de la requête. Vous n'avez donc pas besoin de configurer les variables `SMTP_*` si vous souhaitez utiliser l'envoi local standard de votre hébergement !

---

## 🚀 Étape 4 : Configuration de l'Application Node.js dans cPanel

1. Dans cPanel, recherchez et cliquez sur l'outil **"Inscrire une application Node.js"** (Setup Node.js App).
2. Cliquez sur le bouton **Create Application** (Créer une application).
3. Remplissez le formulaire avec les paramètres suivants :
   - **Node.js version** : Sélectionnez la version recommandée la plus récente (version 18, 20 ou supérieure).
   - **Application mode** : Sélectionnez **Production**.
   - **Application root** : Le chemin vers le dossier contenant vos fichiers (ex: `apps/shortr`).
   - **Application URL** : Sélectionnez le domaine ou sous-domaine sur lequel l'application doit être accessible (ex: `shortr.mon-domaine.fr`).
   - **Application startup file** : Saisissez `app.js`.
4. Cliquez sur le bouton **Create** en haut à droite.

---

## 📦 Étape 5 : Installation des Dépendances

1. Une fois l'application créée, cPanel affiche un encadré contenant une commande pour entrer dans l'environnement virtuel (ex: `source /home/votre_utilisateur/nodevenv/apps/shortr/...`).
2. Faites défiler la page de l'application vers le bas jusqu'à la section **Configuration files**.
3. Si un bouton **Run NPM Install** est visible, cliquez dessus pour installer automatiquement toutes les dépendances listées dans `package.json`.
4. *Alternative via SSH* :
   - Connectez-vous à votre hébergement via SSH.
   - Copiez-collez la commande `source` fournie par cPanel pour activer l'environnement virtuel Node.js.
   - Déplacez-vous dans le dossier de l'application : `cd /home/votre_utilisateur/apps/shortr/`.
   - Exécutez la commande :
     ```bash
     npm install --production
     ```

---

## 🔄 Étape 6 : Démarrage et Validation

1. Retournez dans l'outil **"Inscrire une application Node.js"** de cPanel.
2. Cliquez sur **Restart** pour redémarrer l'application.
3. Visitez l'URL de votre application (ex: `https://shortr.mon-domaine.fr`).
4. Votre instance ShortR est désormais en ligne et prête à être utilisée !
5. Vous pouvez vérifier le bon fonctionnement de l'application en vous inscrivant et en créant votre premier lien raccourci.
