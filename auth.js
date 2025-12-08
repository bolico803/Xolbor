// Module d'authentification pour Xolbor
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    init() {
        this.loadUserData();
        this.checkSession();
    }
    
    // Charger les données utilisateur
    loadUserData() {
        const userData = localStorage.getItem('xolbor_user');
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
            } catch (error) {
                console.error('Erreur de parsing des données utilisateur:', error);
                this.clearUserData();
            }
        }
    }
    
    // Sauvegarder les données utilisateur
    saveUserData(userData) {
        this.currentUser = {
            ...userData,
            timestamp: Date.now()
        };
        
        localStorage.setItem('xolbor_user', JSON.stringify(this.currentUser));
    }
    
    // Vérifier la session
    checkSession() {
        if (!this.currentUser || !this.currentUser.loggedIn) {
            return false;
        }
        
        const currentTime = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (this.currentUser.remember || currentTime - this.currentUser.timestamp < oneDay) {
            // Rafraîchir le timestamp
            this.currentUser.timestamp = currentTime;
            this.saveUserData(this.currentUser);
            return true;
        }
        
        // Session expirée
        this.clearUserData();
        return false;
    }
    
    // Connexion
    async login(username, password) {
        try {
            // Simulation d'appel API
            const response = await this.apiCall('/backend/login.php', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            if (response.success) {
                this.saveUserData({
                    username: response.user.username,
                    email: response.user.email,
                    xuborBalance: response.user.xuborBalance || 0,
                    activeSkin: response.user.activeSkin || null,
                    loggedIn: true,
                    remember: response.user.remember || false
                });
                
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: response.error };
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            return { success: false, error: 'Erreur réseau' };
        }
    }
    
    // Inscription
    async register(userData) {
        try {
            // Vérification du pseudo
            const usernameCheck = await this.checkUsername(userData.username);
            if (!usernameCheck.available) {
                return { success: false, error: 'Ce pseudo est déjà utilisé' };
            }
            
            // Simulation d'appel API
            const response = await this.apiCall('/backend/register.php', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            if (response.success) {
                this.saveUserData({
                    username: response.user.username,
                    email: response.user.email,
                    xuborBalance: 100, // Bonus de bienvenue
                    activeSkin: null,
                    loggedIn: true,
                    remember: false
                });
                
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: response.error };
            }
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            return { success: false, error: 'Erreur réseau' };
        }
    }
    
    // Vérifier la disponibilité du pseudo
    async checkUsername(username) {
        try {
            const response = await this.apiCall('/backend/check_username.php', {
                method: 'POST',
                body: JSON.stringify({ username })
            });
            
            return { available: response.available };
        } catch (error) {
            console.error('Erreur de vérification:', error);
            return { available: false };
        }
    }
    
    // Déconnexion
    logout() {
        this.clearUserData();
        
        // Appel API pour déconnexion côté serveur
        this.apiCall('/backend/logout.php', {
            method: 'POST'
        }).catch(console.error);
        
        // Redirection
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }
    
    // Effacer les données utilisateur
    clearUserData() {
        this.currentUser = null;
        localStorage.removeItem('xolbor_user');
    }
    
    // Appel API générique
    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        // Simulation pour la démo
        if (endpoint.includes('login.php')) {
            return this.simulateLogin(options.body ? JSON.parse(options.body) : {});
        } else if (endpoint.includes('register.php')) {
            return this.simulateRegister(options.body ? JSON.parse(options.body) : {});
        } else if (endpoint.includes('check_username.php')) {
            const body = options.body ? JSON.parse(options.body) : {};
            return this.simulateUsernameCheck(body.username);
        }
        
        // En production, utiliser fetch()
        // const response = await fetch(endpoint, mergedOptions);
        // return await response.json();
    }
    
    // Simulations d'API pour la démo
    simulateLogin(data) {
        return new Promise(resolve => {
            setTimeout(() => {
                if (data.username === 'demo' && data.password === 'demo123') {
                    resolve({
                        success: true,
                        user: {
                            username: 'demo',
                            email: 'demo@xolbor.com',
                            xuborBalance: 1500,
                            activeSkin: 'skin_dragon'
                        }
                    });
                } else {
                    resolve({
                        success: false,
                        error: 'Identifiants incorrects'
                    });
                }
            }, 1000);
        });
    }
    
    simulateRegister(data) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    user: {
                        username: data.username,
                        email: data.email,
                        xuborBalance: 100
                    }
                });
            }, 1500);
        });
    }
    
    simulateUsernameCheck(username) {
        return new Promise(resolve => {
            setTimeout(() => {
                const usedUsernames = ['admin', 'test', 'user', 'demo'];
                resolve({
                    available: !usedUsernames.includes(username.toLowerCase())
                });
            }, 500);
        });
    }
    
    // Vérifier si l'utilisateur est connecté
    isLoggedIn() {
        return this.checkSession();
    }
    
    // Récupérer l'utilisateur actuel
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Mettre à jour le solde Xubor
    updateXuborBalance(amount) {
        if (this.currentUser) {
            this.currentUser.xuborBalance = amount;
            this.saveUserData(this.currentUser);
            return true;
        }
        return false;
    }
    
    // Mettre à jour le skin actif
    updateActiveSkin(skinId) {
        if (this.currentUser) {
            this.currentUser.activeSkin = skinId;
            this.saveUserData(this.currentUser);
            return true;
        }
        return false;
    }
}

// Initialiser l'AuthManager global
window.authManager = new AuthManager();