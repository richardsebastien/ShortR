const translations = {
    en: {
        "nav.dashboard": "Dashboard",
        "nav.logout": "Logout",
        "nav.login": "Login",
        "nav.register": "Register",
        "footer.terms": "Terms of Service",
        "footer.privacy": "Privacy Policy",
        "index.title": "ShortR",
        "index.label.url": "URL to shorten",
        "index.label.custom_code": "Custom code (optional)",
        "index.label.title": "Title (optional)",
        "index.label.expires_at": "Expiration date (optional)",
        "index.label.max_clicks": "Max clicks (optional)",
        "index.label.password": "Password (optional)",
        "index.label.mobile_target": "Mobile target URL (optional)",
        "index.button.shorten": "Shorten",
        "cookie.banner.text": "We use cookies to improve your experience, remember preferences, and keep unlocked links active.",
        "cookie.banner.accept": "Accept",
        "cookie.banner.refuse": "Refuse",
        "index.result.short_link": "Short link:",
        "index.result.stats": "See stats? Use the",
        "index.result.stats_link": "stats page",
        "login.title": "Login - ShortR",
        "login.heading": "Login",
        "login.label.email": "Email",
        "login.label.password": "Password",
        "login.button.login": "Login",
        "login.no_account": "Don't have an account yet?",
        "login.register_link": "Register",
        "register.title": "Register - ShortR",
        "register.heading": "Register",
        "register.label.email": "Email",
        "register.label.password": "Password (8 characters minimum)",
        "register.button.register": "Register",
        "register.already_account": "Already have an account?",
        "register.login_link": "Login",
        "register.success": "Registration successful! You can now log in.",
        "forgot.title": "Forgot Password - ShortR",
        "forgot.heading": "Forgot Password",
        "forgot.label.email": "Email",
        "forgot.button.send": "Send Reset Link",
        "forgot.back_to_login": "Back to Login",
        "forgot.success_message": "If this email is registered, a reset link has been sent. Please check your inbox.",
        "reset.title": "Reset Password - ShortR",
        "reset.heading": "Reset Password",
        "reset.label.password": "New Password (8 characters minimum)",
        "reset.button.reset": "Reset Password",
        "reset.success": "Password reset successfully! You can now log in.",
        "login.forgot_link": "Forgot your password?",
    },
    fr: {
        "nav.dashboard": "Tableau de bord",
        "nav.logout": "Déconnexion",
        "nav.login": "Connexion",
        "nav.register": "Inscription",
        "footer.terms": "Conditions d'utilisation",
        "footer.privacy": "Politique de confidentialité",
        "index.title": "ShortR",
        "index.label.url": "URL à raccourcir",
        "index.label.custom_code": "Code personnalisé (optionnel)",
        "index.label.title": "Titre (optionnel)",
        "index.label.expires_at": "Date d'expiration (optionnelle)",
        "index.label.max_clicks": "Nombre de clics max (optionnel)",
        "index.label.password": "Mot de passe (optionnel)",
        "index.label.mobile_target": "URL cible mobile (optionnelle)",
        "index.button.shorten": "Raccourcir",
        "cookie.banner.text": "Nous utilisons des cookies pour améliorer votre expérience, mémoriser vos préférences et maintenir actifs les liens déverrouillés.",
        "cookie.banner.accept": "Accepter",
        "cookie.banner.refuse": "Refuser",
        "index.result.short_link": "Lien court :",
        "index.result.stats": "Voir les stats ? Utilisez la",
        "index.result.stats_link": "page stats",
        "login.title": "Connexion - ShortR",
        "login.heading": "Connexion",
        "login.label.email": "Email",
        "login.label.password": "Mot de passe",
        "login.button.login": "Se connecter",
        "login.no_account": "Pas encore de compte ?",
        "login.register_link": "Inscrivez-vous",
        "register.title": "Inscription - ShortR",
        "register.heading": "Inscription",
        "register.label.email": "Email",
        "register.label.password": "Mot de passe (8 caractères minimum)",
        "register.button.register": "S'inscrire",
        "register.already_account": "Déjà un compte ?",
        "register.login_link": "Connectez-vous",
        "register.success": "Inscription réussie ! Vous pouvez maintenant vous connecter.",
        "forgot.title": "Mot de passe oublié - ShortR",
        "forgot.heading": "Mot de passe oublié",
        "forgot.label.email": "Email",
        "forgot.button.send": "Envoyer le lien de réinitialisation",
        "forgot.back_to_login": "Retour à la connexion",
        "forgot.success_message": "Si cette adresse email est enregistrée, un lien de réinitialisation a été envoyé. Veuillez vérifier votre boîte de réception.",
        "reset.title": "Réinitialiser le mot de passe - ShortR",
        "reset.heading": "Réinitialiser le mot de passe",
        "reset.label.password": "Nouveau mot de passe (8 caractères minimum)",
        "reset.button.reset": "Réinitialiser le mot de passe",
        "reset.success": "Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.",
        "login.forgot_link": "Mot de passe oublié ?",
    }
};

let sessionLanguage = null;

function setLanguage(lang) {
    sessionLanguage = lang;
    if (localStorage.getItem('cookieConsent') === 'accepted') {
        localStorage.setItem('language', lang);
    }
    updateText();
}

function getDefaultLanguage() {
    if (sessionLanguage) return sessionLanguage;
    const saved = localStorage.getItem('language');
    if (saved && localStorage.getItem('cookieConsent') === 'accepted') return saved;
    const navLang = navigator.language || navigator.userLanguage || 'fr';
    const langCode = navLang.substring(0, 2).toLowerCase();
    return (langCode === 'fr') ? 'fr' : 'en';
}

function getTranslation(key) {
    const lang = getDefaultLanguage();
    return translations[lang][key] || key;
}

// Export helper for external use (e.g. nav.js)
window.getDefaultLanguage = getDefaultLanguage;

function updateText() {
    const lang = getDefaultLanguage();
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(el => {
        const key = el.getAttribute('data-translate');
        el.textContent = getTranslation(key);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateText();
});
