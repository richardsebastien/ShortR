document.addEventListener('DOMContentLoaded', async () => {
    const head = document.head;
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
            <a href="/dashboard.html" class="nav__link">Tableau de bord</a>
            <a href="#" id="logout-btn" class="nav__link nav__link--button">Déconnexion</a>
        `;
    } else {
        menuLinks = `
            <a href="/login.html" class="nav__link">Connexion</a>
            <a href="/register.html" class="nav__link nav__link--button">Inscription</a>
        `;
    }

    navContainer.innerHTML = `
        <nav class="nav">
            <div class="nav__logo">
                <a href="/"><img src="/logo.png" alt="ShortR Logo"></a>
            </div>
            <div class="nav__menu">
                ${menuLinks}
            </div>
        </nav>
    `;

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
            <a href="/terms.html">Conditions d'utilisation</a>
            <a href="/privacy.html">Politique de confidentialité</a>
        </div>
    `;
    document.body.appendChild(footer);
});