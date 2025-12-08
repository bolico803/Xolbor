// Script principal pour Xolbor
document.addEventListener('DOMContentLoaded', function() {
    // Initialisation
    initParticles();
    initTabs();
    initPasswordToggle();
    initUsernameCheck();
    
    // Gestion de la connexion
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Gestion de l'inscription
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Gestion du marketplace
    initMarketplace();
    
    // Gestion des amis
    initFriendsSystem();
    
    // Gestion du paiement
    initPaymentSystem();
    
    // Vérifier si l'utilisateur est connecté
    checkAuthStatus();
});

// Système de particules
function initParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 5 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = `rgba(${Math.floor(Math.random() * 100 + 156)}, ${Math.floor(Math.random() * 100 + 156)}, 255, ${Math.random() * 0.5 + 0.1})`;
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        
        // Animation
        particle.animate([
            { transform: 'translateY(0px)' },
            { transform: `translateY(${Math.random() * 100 - 50}px)` }
        ], {
            duration: Math.random() * 3000 + 2000,
            iterations: Infinity,
            direction: 'alternate'
        });
        
        particlesContainer.appendChild(particle);
    }
}

// Système d'onglets
function initTabs() {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (!loginTab || !registerTab) return;
    
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active-form');
        registerForm.classList.remove('active-form');
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active-form');
        loginForm.classList.remove('active-form');
    });
}

// Toggle mot de passe
function initPasswordToggle() {
    const toggles = [
        { icon: 'toggle-login-password', input: 'login-password' },
        { icon: 'toggle-register-password', input: 'register-password' },
        { icon: 'toggle-confirm-password', input: 'confirm-password' }
    ];
    
    toggles.forEach(toggle => {
        const icon = document.getElementById(toggle.icon);
        const input = document.getElementById(toggle.input);
        
        if (icon && input) {
            icon.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
    });
}

// Vérification du pseudo
function initUsernameCheck() {
    const usernameInput = document.getElementById('register-username');
    const feedback = document.getElementById('username-feedback');
    
    if (!usernameInput || !feedback) return;
    
    usernameInput.addEventListener('input', debounce(async () => {
        const username = usernameInput.value.trim();
        
        if (username.length < 3) {
            feedback.textContent = 'Le pseudo doit contenir au moins 3 caractères';
            feedback.className = 'feedback error';
            return;
        }
        
        if (username.length > 20) {
            feedback.textContent = 'Le pseudo ne doit pas dépasser 20 caractères';
            feedback.className = 'feedback error';
            return;
        }
        
        try {
            // Simulation de vérification
            const isAvailable = await checkUsernameAvailability(username);
            
            if (isAvailable) {
                feedback.textContent = '✓ Pseudo disponible';
                feedback.className = 'feedback success';
            } else {
                feedback.textContent = '✗ Pseudo déjà utilisé';
                feedback.className = 'feedback error';
            }
        } catch (error) {
            feedback.textContent = 'Erreur de vérification';
            feedback.className = 'feedback error';
        }
    }, 500));
}

// Vérifier la disponibilité du pseudo
async function checkUsernameAvailability(username) {
    // Simulation - En production, appeler l'API backend
    const usedUsernames = ['admin', 'test', 'user', 'gamer'];
    return !usedUsernames.includes(username.toLowerCase());
}

// Gestion de la connexion
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    // Simulation de connexion
    showNotification('Connexion en cours...', 'info');
    
    try {
        // En production, appeler l'API backend
        const success = await simulateLogin(username, password);
        
        if (success) {
            showNotification('Connexion réussie !', 'success');
            
            // Stocker les informations de session
            localStorage.setItem('xolbor_user', JSON.stringify({
                username,
                loggedIn: true,
                remember,
                timestamp: Date.now()
            }));
            
            // Redirection vers la page d'accueil
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        } else {
            showNotification('Identifiants incorrects', 'error');
        }
    } catch (error) {
        showNotification('Erreur de connexion', 'error');
    }
}

// Gestion de l'inscription
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const terms = document.getElementById('accept-terms').checked;
    
    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (password.length < 8) {
        showNotification('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }
    
    if (!terms) {
        showNotification('Vous devez accepter les conditions', 'error');
        return;
    }
    
    // Vérification du pseudo
    const isAvailable = await checkUsernameAvailability(username);
    if (!isAvailable) {
        showNotification('Ce pseudo est déjà utilisé', 'error');
        return;
    }
    
    // Simulation d'inscription
    showNotification('Création du compte...', 'info');
    
    try {
        // En production, appeler l'API backend
        const success = await simulateRegister(username, email, password);
        
        if (success) {
            showNotification('Compte créé avec succès !', 'success');
            
            // Auto-connexion
            localStorage.setItem('xolbor_user', JSON.stringify({
                username,
                email,
                loggedIn: true,
                timestamp: Date.now()
            }));
            
            // Redirection
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        }
    } catch (error) {
        showNotification('Erreur lors de la création du compte', 'error');
    }
}

// Simuler la connexion
async function simulateLogin(username, password) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulation - toujours vrai pour la démo
            resolve(username === 'demo' && password === 'demo123');
        }, 1000);
    });
}

// Simuler l'inscription
async function simulateRegister(username, email, password) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulation - toujours vrai pour la démo
            resolve(true);
        }, 1500);
    });
}

// Vérifier le statut d'authentification
function checkAuthStatus() {
    const userData = localStorage.getItem('xolbor_user');
    
    if (userData) {
        const user = JSON.parse(userData);
        const currentTime = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (user.loggedIn && (user.remember || currentTime - user.timestamp < oneDay)) {
            // Mettre à jour le timestamp
            user.timestamp = currentTime;
            localStorage.setItem('xolbor_user', JSON.stringify(user));
            
            // Si on est sur la page de login, rediriger vers l'accueil
            if (window.location.pathname.endsWith('index.html')) {
                window.location.href = 'home.html';
            }
            
            // Mettre à jour l'interface utilisateur
            updateUserInterface(user);
        } else if (!window.location.pathname.endsWith('index.html')) {
            // Déconnecté, rediriger vers login
            window.location.href = 'index.html';
        }
    } else if (!window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
    }
}

// Mettre à jour l'interface utilisateur
function updateUserInterface(user) {
    // Mettre à jour le nom d'utilisateur
    const usernameElements = document.querySelectorAll('.username-display');
    usernameElements.forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = user.username;
        } else {
            el.textContent = user.username;
        }
    });
    
    // Mettre à jour l'avatar
    const avatarElements = document.querySelectorAll('.avatar img, .profile-avatar img');
    avatarElements.forEach(img => {
        img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}&backgroundColor=6C63FF`;
    });
    
    // Charger le solde Xubor
    loadXuborBalance();
    
    // Charger le skin actif
    loadActiveSkin();
}

// Marketplace
function initMarketplace() {
    const skinCards = document.querySelectorAll('.skin-card');
    
    skinCards.forEach(card => {
        const buyBtn = card.querySelector('.buy-btn');
        if (!buyBtn) return;
        
        buyBtn.addEventListener('click', async () => {
            const skinId = card.dataset.skinId;
            const skinPrice = parseInt(card.dataset.price);
            const skinName = card.querySelector('.skin-name').textContent;
            
            if (buyBtn.classList.contains('owned')) {
                // Équiper le skin
                await equipSkin(skinId, skinName);
            } else {
                // Acheter le skin
                await buySkin(skinId, skinPrice, skinName);
            }
        });
    });
}

// Acheter un skin
async function buySkin(skinId, price, name) {
    // Vérifier le solde
    const balance = getXuborBalance();
    
    if (balance < price) {
        showNotification('Solde Xubor insuffisant', 'error');
        showXuborPacks();
        return;
    }
    
    if (!confirm(`Acheter "${name}" pour ${price} Xubor ?`)) {
        return;
    }
    
    try {
        showNotification(`Achat de "${name}" en cours...`, 'info');
        
        // En production, appeler l'API backend
        const success = await simulatePurchase(skinId, price);
        
        if (success) {
            // Mettre à jour le solde
            updateXuborBalance(balance - price);
            
            // Mettre à jour le bouton
            const buyBtn = document.querySelector(`.skin-card[data-skin-id="${skinId}"] .buy-btn`);
            if (buyBtn) {
                buyBtn.textContent = 'ÉQUIPER';
                buyBtn.classList.add('owned');
            }
            
            showNotification(`"${name}" acheté avec succès !`, 'success');
        }
    } catch (error) {
        showNotification('Erreur lors de l\'achat', 'error');
    }
}

// Équiper un skin
async function equipSkin(skinId, name) {
    try {
        showNotification(`Équipement de "${name}"...`, 'info');
        
        // En production, appeler l'API backend
        const success = await simulateEquipSkin(skinId);
        
        if (success) {
            // Mettre à jour l'avatar
            const avatarImg = document.querySelector('.avatar img');
            if (avatarImg) {
                // Ici, vous changeriez l'image du skin
                avatarImg.style.filter = 'hue-rotate(90deg)';
            }
            
            showNotification(`"${name}" équipé !`, 'success');
        }
    } catch (error) {
        showNotification('Erreur lors de l\'équipement', 'error');
    }
}

// Système d'amis
function initFriendsSystem() {
    const addFriendBtn = document.getElementById('add-friend-btn');
    const searchFriendInput = document.getElementById('search-friend');
    
    if (addFriendBtn) {
        addFriendBtn.addEventListener('click', async () => {
            const friendUsername = prompt('Entrez le pseudo de l\'ami à ajouter :');
            if (!friendUsername) return;
            
            if (friendUsername.length < 3) {
                showNotification('Pseudo trop court', 'error');
                return;
            }
            
            await addFriend(friendUsername);
        });
    }
    
    if (searchFriendInput) {
        searchFriendInput.addEventListener('input', debounce(async () => {
            const query = searchFriendInput.value.trim();
            if (query.length >= 2) {
                await searchFriends(query);
            }
        }, 300));
    }
}

// Ajouter un ami
async function addFriend(username) {
    try {
        showNotification(`Envoi de la demande à ${username}...`, 'info');
        
        // En production, appeler l'API backend
        const success = await simulateAddFriend(username);
        
        if (success) {
            showNotification(`Demande envoyée à ${username}`, 'success');
        } else {
            showNotification('Utilisateur introuvable', 'error');
        }
    } catch (error) {
        showNotification('Erreur lors de l\'ajout', 'error');
    }
}

// Rechercher des amis
async function searchFriends(query) {
    // Simulation de recherche
    const friendsList = document.querySelector('.friends-list');
    if (!friendsList) return;
    
    friendsList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
    
    setTimeout(() => {
        // Simulation de résultats
        const results = [
            { name: `${query}Pro`, status: 'En ligne' },
            { name: `${query}Master`, status: 'Hors ligne' },
            { name: `Super${query}`, status: 'En jeu' }
        ];
        
        friendsList.innerHTML = results.map(friend => `
            <div class="friend-card">
                <div class="friend-avatar">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}" alt="${friend.name}">
                </div>
                <div class="friend-info">
                    <h3>${friend.name}</h3>
                    <div class="friend-status">
                        <div class="status-dot"></div>
                        ${friend.status}
                    </div>
                </div>
                <button class="btn-add-friend">Ajouter</button>
            </div>
        `).join('');
    }, 1000);
}

// Système de paiement
function initPaymentSystem() {
    const packCards = document.querySelectorAll('.pack-card');
    const paymentMethods = document.querySelectorAll('.payment-method');
    
    // Sélection des packs
    packCards.forEach(card => {
        card.addEventListener('click', () => {
            packCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
    
    // Sélection des méthodes de paiement
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            paymentMethods.forEach(m => m.classList.remove('selected'));
            method.classList.add('selected');
        });
    });
    
    // Bouton d'achat
    const purchaseBtn = document.getElementById('purchase-btn');
    if (purchaseBtn) {
        purchaseBtn.addEventListener('click', handlePurchase);
    }
}

// Gérer l'achat de Xubor
async function handlePurchase() {
    const selectedPack = document.querySelector('.pack-card.selected');
    if (!selectedPack) {
        showNotification('Veuillez sélectionner un pack', 'error');
        return;
    }
    
    const selectedMethod = document.querySelector('.payment-method.selected');
    if (!selectedMethod) {
        showNotification('Veuillez sélectionner un mode de paiement', 'error');
        return;
    }
    
    const xuborAmount = parseInt(selectedPack.dataset.xubor);
    const price = parseFloat(selectedPack.dataset.price);
    
    if (!confirm(`Acheter ${xuborAmount} Xubor pour ${price}€ ?`)) {
        return;
    }
    
    try {
        showNotification('Traitement du paiement...', 'info');
        
        // Simulation de paiement
        await simulatePayment(xuborAmount, price);
        
        // Mettre à jour le solde
        const currentBalance = getXuborBalance();
        updateXuborBalance(currentBalance + xuborAmount);
        
        showNotification(`${xuborAmount} Xubor ajoutés à votre compte !`, 'success');
        
        // Redirection vers l'accueil
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
    } catch (error) {
        showNotification('Erreur de paiement', 'error');
    }
}

// Gestion Xubor
function getXuborBalance() {
    const userData = localStorage.getItem('xolbor_user');
    if (userData) {
        const user = JSON.parse(userData);
        return user.xuborBalance || 0;
    }
    return 0;
}

function updateXuborBalance(newBalance) {
    const userData = localStorage.getItem('xolbor_user');
    if (userData) {
        const user = JSON.parse(userData);
        user.xuborBalance = newBalance;
        localStorage.setItem('xolbor_user', JSON.stringify(user));
        
        // Mettre à jour l'affichage
        const balanceElements = document.querySelectorAll('.xubor-balance span');
        balanceElements.forEach(el => {
            el.textContent = newBalance.toLocaleString();
        });
    }
}

function loadXuborBalance() {
    const balance = getXuborBalance();
    updateXuborBalance(balance);
}

// Charger le skin actif
function loadActiveSkin() {
    // En production, récupérer depuis le backend
    const userData = localStorage.getItem('xolbor_user');
    if (userData) {
        const user = JSON.parse(userData);
        // Appliquer le skin
        const avatarImg = document.querySelector('.avatar img');
        if (avatarImg && user.activeSkin) {
            // Ici, vous appliqueriez le skin
        }
    }
}

// Afficher les packs Xubor
function showXuborPacks() {
    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.innerHTML = `
        <strong>Solde insuffisant</strong><br>
        <small>Rechargez vos Xubor pour continuer</small>
        <div style="margin-top: 10px;">
            <button onclick="window.location.href='checkout.html'" class="play-btn" style="padding: 8px 15px;">
                Voir les packs
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Utilitaires
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

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <strong>${type === 'error' ? '✗' : type === 'success' ? '✓' : 'ℹ'}</strong>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Simulations d'API
async function simulatePurchase(skinId, price) {
    return new Promise(resolve => {
        setTimeout(() => resolve(true), 1500);
    });
}

async function simulateEquipSkin(skinId) {
    return new Promise(resolve => {
        setTimeout(() => resolve(true), 1000);
    });
}

async function simulateAddFriend(username) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulation - toujours vrai pour la démo
            resolve(username.length >= 3);
        }, 1000);
    });
}

async function simulatePayment(amount, price) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulation - toujours vrai pour la démo
            resolve(true);
        }, 2000);
    });
}

// Déconnexion
function logout() {
    localStorage.removeItem('xolbor_user');
    window.location.href = 'index.html';
}

// Exporter les fonctions globales
window.logout = logout;
window.showXuborPacks = showXuborPacks;