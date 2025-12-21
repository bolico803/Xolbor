// Gestionnaire d'authentification
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadSession();
        this.setupForms();
        this.protectPages();
    }

    loadSession() {
        const userData = localStorage.getItem('xolbor_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            this.updateUI();
        }
    }

    saveSession(user) {
        this.currentUser = user;
        localStorage.setItem('xolbor_user', JSON.stringify(user));
        this.updateUI();
    }

    clearSession() {
        this.currentUser = null;
        localStorage.removeItem('xolbor_user');
        this.updateUI();
    }

    async login(email, password) {
        try {
            showLoading('Connexion en cours...');
            
            // Simulation de requête API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Vérification basique
            if (!email || !password) {
                throw new Error('Veuillez remplir tous les champs');
            }

            // Simulation d'utilisateur
            const user = {
                id: 1,
                username: email.split('@')[0],
                email: email,
                xuborBalance: 1500,
                level: 1,
                xp: 0,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
                createdAt: new Date().toISOString()
            };

            this.saveSession(user);
            showNotification('Connexion réussie !', 'success');
            
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);

            return true;
            
        } catch (error) {
            showNotification(error.message || 'Erreur de connexion', 'error');
            return false;
        } finally {
            hideLoading();
        }
    }

    async register(username, email, password) {
        try {
            showLoading('Inscription en cours...');
            
            // Simulation de requête API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Validation
            if (!username || !email || !password) {
                throw new Error('Veuillez remplir tous les champs');
            }

            if (password.length < 8) {
                throw new Error('Le mot de passe doit contenir au moins 8 caractères');
            }

            if (!validateEmail(email)) {
                throw new Error('Adresse email invalide');
            }

            // Simulation d'utilisateur
            const user = {
                id: Date.now(),
                username: username,
                email: email,
                xuborBalance: 100, // Bonus d'inscription
                level: 1,
                xp: 0,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                createdAt: new Date().toISOString()
            };

            this.saveSession(user);
            showNotification('Inscription réussie ! 100 Xubor offerts 🎉', 'success');
            
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);

            return true;
            
        } catch (error) {
            showNotification(error.message || 'Erreur d\'inscription', 'error');
            return false;
        } finally {
            hideLoading();
        }
    }

    logout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            this.clearSession();
            showNotification('Déconnexion réussie', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateUI() {
        // Mettre à jour les éléments UI avec les informations utilisateur
        if (this.currentUser) {
            document.querySelectorAll('[data-user-field="username"]').forEach(el => {
                el.textContent = this.currentUser.username;
            });
            
            document.querySelectorAll('[data-user-field="xuborBalance"]').forEach(el => {
                el.textContent = this.currentUser.xuborBalance.toLocaleString();
            });
            
            document.querySelectorAll('[data-user-field="level"]').forEach(el => {
                el.textContent = this.currentUser.level;
            });
            
            document.querySelectorAll('[data-user-field="avatar"]').forEach(el => {
                if (el.tagName === 'IMG') {
                    el.src = this.currentUser.avatar;
                }
            });

            // Afficher les éléments pour utilisateur connecté
            document.querySelectorAll('[data-auth-state="logged-in"]').forEach(el => {
                el.style.display = 'block';
            });
            
            document.querySelectorAll('[data-auth-state="logged-out"]').forEach(el => {
                el.style.display = 'none';
            });
        } else {
            // Afficher les éléments pour visiteur
            document.querySelectorAll('[data-auth-state="logged-in"]').forEach(el => {
                el.style.display = 'none';
            });
            
            document.querySelectorAll('[data-auth-state="logged-out"]').forEach(el => {
                el.style.display = 'block';
            });
        }
    }

    setupForms() {
        // Formulaire de connexion
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = loginForm.querySelector('[name="email"]').value;
                const password = loginForm.querySelector('[name="password"]').value;
                
                await this.login(email, password);
            });
        }

        // Formulaire d'inscription
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = registerForm.querySelector('[name="username"]').value;
                const email = registerForm.querySelector('[name="email"]').value;
                const password = registerForm.querySelector('[name="password"]').value;
                const confirmPassword = registerForm.querySelector('[name="confirmPassword"]').value;
                
                if (password !== confirmPassword) {
                    showNotification('Les mots de passe ne correspondent pas', 'error');
                    return;
                }
                
                await this.register(username, email, password);
            });
        }

        // Bouton de déconnexion
        document.querySelectorAll('[data-action="logout"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    protectPages() {
        const protectedPages = ['home.html', 'friends.html', 'marketplace.html', 'profile.html', 'games.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (protectedPages.includes(currentPage) && !this.isLoggedIn()) {
            showNotification('Veuillez vous connecter pour accéder à cette page', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    }

    // Méthodes utilitaires
    async updateUser(data) {
        try {
            if (!this.currentUser) return false;
            
            // Simulation de mise à jour
            this.currentUser = { ...this.currentUser, ...data };
            this.saveSession(this.currentUser);
            
            showNotification('Profil mis à jour avec succès', 'success');
            return true;
            
        } catch (error) {
            showNotification('Erreur de mise à jour', 'error');
            return false;
        }
    }

    async addXubor(amount) {
        if (!this.currentUser) return false;
        
        this.currentUser.xuborBalance += amount;
        this.saveSession(this.currentUser);
        
        showNotification(`+${amount} Xubor ajoutés !`, 'success');
        return true;
    }

    async deductXubor(amount) {
        if (!this.currentUser || this.currentUser.xuborBalance < amount) {
            showNotification('Solde insuffisant', 'error');
            return false;
        }
        
        this.currentUser.xuborBalance -= amount;
        this.saveSession(this.currentUser);
        
        showNotification(`-${amount} Xubor déduits`, 'info');
        return true;
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
    
    // Fonctions globales d'aide
    window.showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Suppression automatique
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    };

    window.showLoading = (message = 'Chargement...') => {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.querySelector('p').textContent = message;
        }
        
        overlay.style.display = 'flex';
    };

    window.hideLoading = () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    };

    // Styles pour les notifications et chargement
    const styles = document.createElement('style');
    styles.textContent = `
        .notification-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--dark-light);
            color: var(--text);
            padding: 15px 20px;
            border-radius: 10px;
            border-left: 4px solid var(--primary);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            transform: translateX(120%);
            transition: transform 0.3s ease;
            z-index: 10000;
            max-width: 350px;
        }
        
        .notification-toast.show {
            transform: translateX(0);
        }
        
        .notification-toast.success {
            border-left-color: var(--success);
        }
        
        .notification-toast.error {
            border-left-color: var(--danger);
        }
        
        .notification-toast.info {
            border-left-color: var(--info);
        }
        
        #loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 15, 35, 0.9);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 20px;
            z-index: 9999;
        }
        
        .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(108, 99, 255, 0.3);
            border-top: 3px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styles);
});

// Fonctions utilitaires
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function debounce(func, wait) {
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
