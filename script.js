// Configuration globale
const CONFIG = {
    API_URL: 'http://localhost:3000/api',
    SITE_NAME: 'Xolbor',
    VERSION: '1.0.0'
};

// Gestionnaire d'authentification
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('xolbor_token');
        this.init();
    }

    init() {
        this.loadUser();
        this.setupEventListeners();
    }

    async loadUser() {
        if (this.token) {
            try {
                const response = await fetch(`${CONFIG.API_URL}/user`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
                
                if (response.ok) {
                    this.currentUser = await response.json();
                    this.updateUI();
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Erreur de chargement utilisateur:', error);
                // Simulation pour la démo
                this.simulateUser();
            }
        } else {
            this.simulateUser();
        }
    }

    simulateUser() {
        // Simulation d'utilisateur pour la démo
        this.currentUser = {
            id: 1,
            username: 'PlayerOne',
            email: 'player@xolbor.com',
            xuborBalance: 1500,
            level: 42,
            xp: 12500,
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PlayerOne',
            createdAt: new Date().toISOString()
        };
        this.updateUI();
    }

    async login(email, password) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('xolbor_token', this.token);
                this.updateUI();
                showNotification('Connexion réussie !', 'success');
                return true;
            } else {
                showNotification(data.message || 'Erreur de connexion', 'error');
                return false;
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            // Simulation pour la démo
            this.simulateUser();
            showNotification('Connexion réussie (simulation)', 'success');
            return true;
        }
    }

    async register(username, email, password) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            
            if (data.success) {
                showNotification('Inscription réussie !', 'success');
                return true;
            } else {
                showNotification(data.message || 'Erreur d\'inscription', 'error');
                return false;
            }
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            showNotification('Inscription réussie (simulation)', 'success');
            return true;
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('xolbor_token');
        window.location.href = 'index.html';
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    updateUI() {
        // Mettre à jour l'affichage de l'utilisateur
        const userElements = document.querySelectorAll('[data-user-info]');
        userElements.forEach(element => {
            const prop = element.dataset.userInfo;
            if (prop === 'username') {
                element.textContent = this.currentUser.username;
            } else if (prop === 'xuborBalance') {
                element.textContent = this.currentUser.xuborBalance.toLocaleString();
            } else if (prop === 'level') {
                element.textContent = this.currentUser.level;
            } else if (prop === 'xp') {
                element.textContent = this.currentUser.xp.toLocaleString();
            } else if (prop === 'avatar' && element.tagName === 'IMG') {
                element.src = this.currentUser.avatar;
            }
        });

        // Afficher/masquer les éléments selon l'état de connexion
        const authElements = document.querySelectorAll('[data-auth-state]');
        authElements.forEach(element => {
            const state = element.dataset.authState;
            if (state === 'logged-in') {
                element.style.display = this.isLoggedIn() ? 'block' : 'none';
            } else if (state === 'logged-out') {
                element.style.display = this.isLoggedIn() ? 'none' : 'block';
            }
        });
    }

    setupEventListeners() {
        // Gestion de la déconnexion
        const logoutButtons = document.querySelectorAll('[data-action="logout"]');
        logoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Gestionnaire de notifications
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.createContainer();
        }
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        }[type];

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <i class="${icon}" style="font-size: 20px;"></i>
                <div>
                    <strong>${this.getTitle(type)}</strong>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">${message}</p>
                </div>
                <button class="close-notification" style="margin-left: auto; background: none; border: none; color: inherit; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        this.container.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Fermeture automatique
        const autoClose = setTimeout(() => {
            this.close(notification);
        }, duration);

        // Fermeture manuelle
        const closeBtn = notification.querySelector('.close-notification');
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoClose);
            this.close(notification);
        });
    }

    getTitle(type) {
        const titles = {
            success: 'Succès',
            error: 'Erreur',
            info: 'Information',
            warning: 'Attention'
        };
        return titles[type] || 'Notification';
    }

    close(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

// Gestionnaire de modals
class ModalManager {
    constructor() {
        this.modals = new Map();
        this.setupEventListeners();
    }

    register(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const overlay = modal.closest('.modal-overlay') || this.createOverlay(modal);
        
        this.modals.set(modalId, { modal, overlay, options });

        // Bouton de fermeture
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(modalId));
        }

        // Fermeture en cliquant sur l'overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && options.closeOnOverlay !== false) {
                this.close(modalId);
            }
        });
    }

    createOverlay(modal) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        modal.parentNode.insertBefore(overlay, modal);
        overlay.appendChild(modal);
        return overlay;
    }

    open(modalId) {
        const modalData = this.modals.get(modalId);
        if (!modalData) return;

        const { overlay, options } = modalData;
        
        // Fermer les autres modals
        this.closeAll();

        // Ouvrir ce modal
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Callback d'ouverture
        if (options.onOpen) {
            options.onOpen();
        }
    }

    close(modalId) {
        const modalData = this.modals.get(modalId);
        if (!modalData) return;

        const { overlay, options } = modalData;
        
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        // Callback de fermeture
        if (options.onClose) {
            options.onClose();
        }
    }

    closeAll() {
        this.modals.forEach(({ overlay }) => {
            overlay.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    setupEventListeners() {
        // Fermeture avec ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }
}

// Gestionnaire de chargement
class LoadingManager {
    constructor() {
        this.overlay = this.createOverlay();
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 15, 35, 0.9);
            backdrop-filter: blur(10px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            flex-direction: column;
            gap: 20px;
        `;

        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.style.cssText = `
            width: 60px;
            height: 60px;
            border: 4px solid rgba(108, 99, 255, 0.3);
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;

        const text = document.createElement('p');
        text.textContent = 'Chargement...';
        text.style.color = 'var(--text)';
        text.style.fontFamily = 'Orbitron, sans-serif';

        overlay.appendChild(spinner);
        overlay.appendChild(text);
        document.body.appendChild(overlay);

        // Ajouter l'animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        return overlay;
    }

    show(message = 'Chargement...') {
        const text = this.overlay.querySelector('p');
        if (text) text.textContent = message;
        this.overlay.style.display = 'flex';
    }

    hide() {
        this.overlay.style.display = 'none';
    }
}

// Utilitaires
class Utils {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    static formatDate(date) {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    static copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copié dans le presse-papier', 'success');
        }).catch(err => {
            console.error('Erreur de copie:', err);
            showNotification('Erreur de copie', 'error');
        });
    }
}

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser les managers
    window.authManager = new AuthManager();
    window.notificationManager = new NotificationManager();
    window.modalManager = new ModalManager();
    window.loadingManager = new LoadingManager();
    
    // Définir les fonctions globales
    window.showNotification = (message, type = 'info') => {
        window.notificationManager.show(message, type);
    };

    window.showLoading = (message) => {
        window.loadingManager.show(message);
    };

    window.hideLoading = () => {
        window.loadingManager.hide();
    };

    // Initialiser les modals
    document.querySelectorAll('.modal').forEach(modal => {
        const modalId = modal.id;
        if (modalId) {
            window.modalManager.register(modalId);
        }
    });

    // Gestion du menu mobile
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Gestion des onglets
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            const container = tab.closest('.tabs-container');
            
            // Mettre à jour l'onglet actif
            container.querySelectorAll('[data-tab]').forEach(t => {
                t.classList.toggle('active', t === tab);
            });

            // Afficher le contenu correspondant
            container.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabId}-tab`);
            });
        });
    });

    // Gestion des tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = element.dataset.tooltip;
            
            Object.assign(tooltip.style, {
                position: 'absolute',
                background: 'var(--dark-light)',
                color: 'var(--text)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                zIndex: '1000',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            });

            document.body.appendChild(tooltip);

            const rect = element.getBoundingClientRect();
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
            tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;

            element._tooltip = tooltip;
        });

        element.addEventListener('mouseleave', () => {
            if (element._tooltip) {
                element._tooltip.remove();
                delete element._tooltip;
            }
        });
    });

    // Gestion du thème
    const themeToggle = document.querySelector('[data-theme-toggle]');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            showNotification(`Thème ${isLight ? 'clair' : 'sombre'} activé`, 'info');
        });
    }

    // Charger le thème sauvegardé
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    console.log(`${CONFIG.SITE_NAME} v${CONFIG.VERSION} initialisé`);
});

// Fonctions d'aide globales
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function getRandomColor() {
    const colors = ['#6C63FF', '#FF6584', '#00D4AA', '#FFB84D', '#1E90FF'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AuthManager,
        NotificationManager,
        ModalManager,
        LoadingManager,
        Utils
    };
}
