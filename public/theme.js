// Function to apply the saved theme
function applyTheme(theme) {
    if (theme === 'light-theme') {
        document.documentElement.classList.add('light-theme');
    } else {
        document.documentElement.classList.remove('light-theme');
    }
    if (localStorage.getItem('cookieConsent') === 'accepted') {
        localStorage.setItem('theme', theme);
    }
}

// Function to toggle between light and dark theme
function toggleTheme() {
    const currentTheme = (localStorage.getItem('cookieConsent') === 'accepted' && localStorage.getItem('theme')) || 'dark-theme';
    const newTheme = currentTheme === 'dark-theme' ? 'light-theme' : 'dark-theme';
    applyTheme(newTheme);
}

// Immediately invoked function to set the theme on initial load
(function () {
    const savedTheme = (localStorage.getItem('cookieConsent') === 'accepted' && localStorage.getItem('theme')) || 'dark-theme';
    applyTheme(savedTheme);
})();
