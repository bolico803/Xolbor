document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const iframe = document.getElementById('browser-iframe');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const homeBtn = document.getElementById('home-btn');
    const loader = document.getElementById('loader');
    const bookmarks = document.querySelectorAll('.bookmark');

    let history = ['http://localhost:5173'];
    let currentIndex = 0;

    const navigateTo = (url) => {
        let displayUrl = url;
        let actualUrl = url;

        // Custom domain mapping
        const lowerUrl = url.toLowerCase();
        const xolborAliases = ['xolbor.ma', 'xolbor.com', 'http://xolbor.ma', 'http://xolbor.com', 'https://xolbor.ma', 'https://xolbor.com', 'localhost:5173', 'http://localhost:5173'];

        if (xolborAliases.includes(lowerUrl)) {
            actualUrl = 'http://localhost:5173';
            displayUrl = lowerUrl.replace('http://', '').replace('https://', '');
        } else {
            // Check if it's a URL or a search query
            const isUrl = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(url);

            if (!isUrl && !url.includes('://') && !url.includes('localhost')) {
                // It's a search query
                actualUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}&igu=1`;
                displayUrl = url;
            } else if (!actualUrl.startsWith('http://') && !actualUrl.startsWith('https://')) {
                actualUrl = 'https://' + actualUrl;
            }
        }

        showLoader();
        iframe.src = actualUrl;
        urlInput.value = displayUrl;

        // Simple history logic (mocking real browser behavior as much as possible with iframe limitations)
        if (actualUrl !== history[currentIndex]) {
            history = history.slice(0, currentIndex + 1);
            history.push(actualUrl);
            currentIndex++;
        }
        updateNavButtons();
    };

    const showLoader = () => {
        loader.classList.remove('hidden');
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 1000);
    };

    const updateNavButtons = () => {
        backBtn.disabled = currentIndex === 0;
        forwardBtn.disabled = currentIndex === history.length - 1;

        backBtn.style.opacity = backBtn.disabled ? '0.3' : '1';
        forwardBtn.style.opacity = forwardBtn.disabled ? '0.3' : '1';
    };

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            navigateTo(urlInput.value);
        }
    });

    backBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            navigateTo(history[currentIndex]);
        }
    });

    forwardBtn.addEventListener('click', () => {
        if (currentIndex < history.length - 1) {
            currentIndex++;
            navigateTo(history[currentIndex]);
        }
    });

    reloadBtn.addEventListener('click', () => {
        showLoader();
        iframe.src = iframe.src;
    });

    homeBtn.addEventListener('click', () => {
        navigateTo('xolbor.ma');
    });

    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', () => {
            navigateTo(bookmark.getAttribute('data-url'));
        });
    });

    // Initial button state
    updateNavButtons();

    // Note: Due to security restrictions (CORS), we can't truly listen 
    // to iframe URL changes or go back/forward in the real browser sense 
    // unless the sites are on the same domain. This is a simulation.
});
