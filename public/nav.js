document.addEventListener('DOMContentLoaded', async () => {
    const head = document.head;

    // Add theme.js script
    const themeScript = document.createElement('script');
    themeScript.src = '/theme.js';
    head.appendChild(themeScript);

    // Add translations.js script
    const translationsScript = document.createElement('script');
    translationsScript.src = '/translations.js';
    head.appendChild(translationsScript);

    const footerStyle = document.createElement('link');
    footerStyle.rel = 'stylesheet';
    footerStyle.href = '/footer.css';
    head.appendChild(footerStyle);

    const navContainer = document.createElement('div');
    document.body.prepend(navContainer);

    const response = await fetch('/api/auth/status', { credentials: 'same-origin' });
    const authStatus = await response.json();

    let menuLinks;
    if (authStatus.loggedIn) {
        menuLinks = `
            <a href="/dashboard.html" class="nav__link" data-translate="nav.dashboard">Tableau de bord</a>
            <a href="#" id="logout-btn" class="nav__link nav__link--button" data-translate="nav.logout">Déconnexion</a>
        `;
    } else {
        menuLinks = `
            <a href="/login.html" class="nav__link" data-translate="nav.login">Connexion</a>
            <a href="/register.html" class="nav__link nav__link--button" data-translate="nav.register">Inscription</a>
        `;
    }

    navContainer.innerHTML = `
        <nav class="nav">
            <div class="nav__logo">
                <a href="/"><img src="/logo.png" alt="ShortR Logo"></a>
            </div>
            <div class="nav__menu">
                ${menuLinks}
                <label class="theme-switch" title="Changer de thème">
                    <input type="checkbox" id="theme-toggle">
                    <span class="slider">
                        <span class="slider-sun">☀️</span>
                        <span class="slider-moon">🌙</span>
                        <span class="slider-ball"></span>
                    </span>
                </label>
                <select id="lang-select" class="nav__select" aria-label="Langue / Language">
                    <option value="fr">🇫🇷 FR</option>
                    <option value="en">🇬🇧 EN</option>
                </select>
            </div>
        </nav>
    `;

    // Sync theme toggle checkbox and add event listener
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme') || 'dark-theme';
        themeToggle.checked = (savedTheme === 'light-theme');
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'light-theme' : 'dark-theme';
            if (typeof applyTheme === 'function') {
                applyTheme(newTheme);
            } else {
                if (newTheme === 'light-theme') {
                    document.documentElement.classList.add('light-theme');
                } else {
                    document.documentElement.classList.remove('light-theme');
                }
                localStorage.setItem('theme', newTheme);
            }
        });
    }

    // Sync language select dropdown and add event listener
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        const savedLang = localStorage.getItem('language') || 'fr';
        langSelect.value = savedLang;
        langSelect.addEventListener('change', () => {
            setLanguage(langSelect.value);
        });
    }


    if (authStatus.loggedIn) {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                window.location.href = '/';
            });
        }
    }

    const footer = document.createElement('footer');
    footer.innerHTML = `
        <div class="footer-links">
            <a href="/terms.html" data-translate="footer.terms">Conditions d'utilisation</a>
            <a href="/privacy.html" data-translate="footer.privacy">Politique de confidentialité</a>
        </div>
    `;
    document.body.appendChild(footer);

    // Initial text update after DOM is built
    updateText();
});