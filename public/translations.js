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
        "index.button.shorten": "Shorten",
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
        "forgot.success_message": "Reset link generated successfully! You can click the link below to reset your password:",
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
        "index.button.shorten": "Raccourcir",
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
        "forgot.success_message": "Lien de réinitialisation généré avec succès ! Vous pouvez cliquer sur le lien ci-dessous pour réinitialiser votre mot de passe :",
        "reset.title": "Réinitialiser le mot de passe - ShortR",
        "reset.heading": "Réinitialiser le mot de passe",
        "reset.label.password": "Nouveau mot de passe (8 caractères minimum)",
        "reset.button.reset": "Réinitialiser le mot de passe",
        "reset.success": "Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.",
        "login.forgot_link": "Mot de passe oublié ?",
    }
};

function setLanguage(lang) {
    localStorage.setItem('language', lang);
    updateText();
}

function getTranslation(key) {
    const lang = localStorage.getItem('language') || 'fr';
    return translations[lang][key] || key;
}

function updateText() {
    const lang = localStorage.getItem('language') || 'fr';
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(el => {
        const key = el.getAttribute('data-translate');
        el.textContent = getTranslation(key);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateText();
});
