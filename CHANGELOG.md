# Journal des Modifications (Changelog) - ShortR

Toutes les modifications notables apportées au projet **ShortR** seront documentées dans ce fichier.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet respecte le [Versionnage Sémantique](https://semver.org/lang/fr/).

---

## [1.0.0] - 2026-07-22

### Raccourcisseur d'URL & Redirection
- **Raccourcissement rapide** : Création instantanée de liens courts à partir d'une URL cible.
- **Codes personnalisés** : Possibilité de personnaliser l'alias de l'URL raccourcie.
- **Génération automatique de QR Code** : Production d'un QR code haute résolution téléchargeable (format PNG) pour chaque lien généré.
- **Écran de redirection intermédiaire** : Ajout d'une page de transition sécurisée affichant clairement la destination avec un compte à rebours de 5 secondes, améliorant la confidentialité et prévenant le phishing.
- **Gestion de l'éphémérité** :
  - Définition d'une date d'expiration pour les liens.
  - Fixation d'une limite maximale de clics (max clicks).
  - Page d'erreur dédiée (HTTP 410 Gone) bilingue lorsque le lien expire ou atteint sa limite de clics.
- **Ciblage par appareil** : Prise en charge d'une URL cible alternative spécifique pour les appareils mobiles (iOS/Android).
- **Protection par mot de passe** : Sécurisation de l'accès aux liens par un mot de passe obligatoire.

### Tableau de Bord & Analyse (Statistiques Privées)
- **Espace utilisateur sécurisé** : Inscription, connexion et réinitialisation de mot de passe par courriel HTML élégant (avec fallback SMTP local/console).
- **Visualisation temporelle** : Filtres analytiques pour observer le trafic sur les dernières 24h, 7 jours ou 30 jours.
- **Graphique d'évolution** : Courbe chronologique interactive des visites.
- **Carte de géolocalisation interactive** : Cartographie des clics reposant sur Leaflet.js et l'API ip-api.com (récupération asynchrone du pays, latitude et longitude).
- **Analyse d'audience avancée** : Identification des référents (Referrers) et détection des paramètres de campagnes marketing UTM (`utm_source`, `utm_medium`, `utm_campaign`).
- **Export de données** : Possibilité de télécharger l'historique complet en formats **CSV** ou **Excel (.xlsx)**.

### Ergonomie, Thèmes & Internationalisation (i18n)
- **Design Responsive** : Interface épurée et moderne, optimisée pour mobiles, tablettes et ordinateurs.
- **Double thème natif (Sombre/Clair)** : Un sélecteur coulissant Lune/Soleil intégré à la barre de navigation.
- **Bilinguisme (Français/Anglais)** : Traduction complète via des attributs `data-translate`, avec détection automatique de la langue du navigateur et mémorisation dans le `localStorage`.
- **Bannière RGPD** : Bandeau de consentement relatif aux cookies d'analyse et de préférence.

### Robustesse & Base de Données
- **Migration automatique (Self-Healing)** : L'application vérifie et applique dynamiquement les colonnes manquantes (jetons de réinitialisation, dates d'expiration, limites de clics, etc.) à chaque démarrage.
- **Limitation de requêtes (Rate Limiting)** : Protection de l'API de création de liens contre les abus et le spam.
