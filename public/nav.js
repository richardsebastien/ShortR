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
        const savedTheme = (localStorage.getItem('cookieConsent') === 'accepted' && localStorage.getItem('theme')) || 'dark-theme';
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
                if (localStorage.getItem('cookieConsent') === 'accepted') {
                    localStorage.setItem('theme', newTheme);
                }
            }
        });
    }

    // Sync language select dropdown and add event listener
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        const savedLang = (typeof getDefaultLanguage === 'function')
            ? getDefaultLanguage()
            : ((localStorage.getItem('cookieConsent') === 'accepted' && localStorage.getItem('language')) || 'fr');
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

    // Cookie Consent Banner
    if (!localStorage.getItem('cookieConsent')) {
        const cookieBanner = document.createElement('div');
        cookieBanner.id = 'cookie-consent-banner';
        cookieBanner.style.position = 'fixed';
        cookieBanner.style.bottom = '20px';
        cookieBanner.style.left = '50%';
        cookieBanner.style.transform = 'translateX(-50%)';
        cookieBanner.style.width = '90%';
        cookieBanner.style.maxWidth = '550px';
        cookieBanner.style.backgroundColor = 'var(--input-bg-color, #0e1533)';
        cookieBanner.style.border = '1px solid var(--input-border-color, #2b3355)';
        cookieBanner.style.borderRadius = '12px';
        cookieBanner.style.padding = '16px 20px';
        cookieBanner.style.boxShadow = '0 10px 25px rgba(0,0,0,0.4)';
        cookieBanner.style.zIndex = '99999';
        cookieBanner.style.display = 'flex';
        cookieBanner.style.flexDirection = 'row';
        cookieBanner.style.alignItems = 'center';
        cookieBanner.style.justifyContent = 'space-between';
        cookieBanner.style.gap = '16px';
        cookieBanner.style.boxSizing = 'border-box';

        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const handleMobile = (e) => {
            if (e.matches) {
                cookieBanner.style.flexDirection = 'column';
                cookieBanner.style.textAlign = 'center';
            } else {
                cookieBanner.style.flexDirection = 'row';
                cookieBanner.style.textAlign = 'left';
            }
        };
        mediaQuery.addEventListener('change', handleMobile);
        handleMobile(mediaQuery);

        cookieBanner.innerHTML = `
            <p style="margin: 0; font-size: 14px; line-height: 1.4; color: var(--text-color, #e6ebff);" data-translate="cookie.banner.text">
                Nous utilisons des cookies pour améliorer votre expérience...
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: nowrap;">
                <button id="cookie-refuse-btn" style="padding: 8px 16px; font-size: 14px; white-space: nowrap; flex-shrink: 0; background-color: transparent; border: 1px solid var(--input-border-color, #2b3355); color: var(--text-color, #e6ebff); border-radius: 6px; cursor: pointer;" data-translate="cookie.banner.refuse">
                    Refuser
                </button>
                <button id="cookie-accept-btn" style="padding: 8px 16px; font-size: 14px; white-space: nowrap; flex-shrink: 0; background-color: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;" data-translate="cookie.banner.accept">
                    Accepter
                </button>
            </div>
        `;

        document.body.appendChild(cookieBanner);

        document.getElementById('cookie-accept-btn').addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'accepted');
            cookieBanner.remove();
        });

        document.getElementById('cookie-refuse-btn').addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'refused');
            localStorage.removeItem('theme');
            localStorage.removeItem('language');
            cookieBanner.remove();
        });
    }

    // Initial text update after DOM is built
    updateText();
});