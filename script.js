// Configuration
const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Vérification de l'authentification
async function checkAuth() {
    const token = localStorage.getItem('xolbor_token');
    
    if (token) {
        try {
            const response = await fetch(`${API_URL}/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                authToken = token;
                showMainPage();
                loadUserData();
            } else {
                showLoginPage();
            }
        } catch (error) {
            console.error('Erreur de vérification:', error);
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Login/Register
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('guest-btn').addEventListener('click', handleGuestLogin);
    
    // Navigation principale
    document.querySelectorAll('.side-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href').substring(1);
            showSection(target);
            
            // Mettre à jour la navigation active
            document.querySelectorAll('.side-nav a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
    
    // Marketplace
    document.getElementById('skin-search').addEventListener('input', loadSkins);
    document.getElementById('skin-filter').addEventListener('change', loadSkins);
    
    // Boutique Xubor
    document.querySelectorAll('.buy-pack').forEach(button => {
        button.addEventListener('click', (e) => {
            const amount = parseInt(e.target.dataset.amount);
            const price = parseInt(e.target.dataset.price);
            showPaymentModal(amount, price);
        });
    });
    
    // Modal de paiement
    const modal = document.getElementById('payment-modal');
    document.querySelector('.close-modal').addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    document.getElementById('payment-form').addEventListener('submit', handleXuborPurchase);

    // Modal pour ouvrir les jeux intégrés (ex: Veck.io)
    document.querySelectorAll('.open-game').forEach(el => {
        el.addEventListener('click', (e) => {
            const src = el.dataset.src;
            const title = el.querySelector('.game-info h4')?.textContent || 'Jeu';
            openGameModal(src, title);
        });
    });

    const gameModalCloseBtn = document.querySelector('.close-game');
    const modalBackdrop = document.querySelector('#game-modal .modal-backdrop');
    if (gameModalCloseBtn) gameModalCloseBtn.addEventListener('click', closeGameModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeGameModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGameModal();
    });
    
    // Recherche globale
    document.getElementById('global-search').addEventListener('input', handleGlobalSearch);
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Vérification du pseudo
    document.getElementById('register-username').addEventListener('input', checkUsernameAvailability);
    
    // Amis - Recherche
    document.querySelector('.add-friend button').addEventListener('click', sendFriendRequest);
}

// Gestion de l'authentification
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('xolbor_token', data.token);
            localStorage.setItem('xolbor_user', JSON.stringify(data.user));
            currentUser = data.user;
            authToken = data.token;
            showMainPage();
            loadUserData();
        } else {
            alert(data.error || 'Identifiants incorrects');
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        alert('Erreur de connexion au serveur');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    if (password !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Compte créé avec succès !');
            localStorage.setItem('xolbor_token', data.token);
            localStorage.setItem('xolbor_user', JSON.stringify(data.user));
            currentUser = data.user;
            authToken = data.token;
            showMainPage();
            loadUserData();
        } else {
            alert(data.error || 'Erreur lors de l\'inscription');
        }
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        alert('Erreur de connexion au serveur');
    }
}

async function checkUsernameAvailability() {
    const username = document.getElementById('register-username').value;
    const feedback = document.getElementById('username-feedback');
    
    if (username.length < 3) {
        feedback.textContent = 'Minimum 3 caractères';
        feedback.style.color = 'var(--warning)';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/check-username?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        
        if (data.available) {
            feedback.textContent = '✓ Disponible';
            feedback.style.color = 'var(--success)';
        } else {
            feedback.textContent = '✗ Déjà utilisé';
            feedback.style.color = 'var(--danger)';
        }
    } catch (error) {
        console.error('Erreur de vérification:', error);
    }
}

function handleGuestLogin() {
    // Pour les démos, créer un utilisateur temporaire
    const guestUser = {
        id: 'guest_' + Date.now(),
        username: 'Invité_' + Math.floor(Math.random() * 1000),
        xubor: 500,
        avatar: 'default'
    };
    
    currentUser = guestUser;
    showMainPage();
    updateProfileDisplay();
}

// Gestion de la navigation
function showLoginPage() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-page').classList.remove('active');
    showLoginForm();
}

function showMainPage() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-page').classList.add('active');
    showSection('home');
}

function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

function showSection(sectionId) {
    // Cacher toutes les sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Afficher la section demandée
    const targetSection = document.getElementById(sectionId + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Charger les données de la section
        switch(sectionId) {
            case 'home':
                loadGames();
                break;
            case 'marketplace':
                loadSkins();
                break;
            case 'friends-page':
                loadFriends();
                break;
            case 'shop':
                // La boutique est déjà chargée
                break;
        }
    }
}

// Chargement des données utilisateur
async function loadUserData() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = { ...currentUser, ...data };
            updateProfileDisplay();
        }
    } catch (error) {
        console.error('Erreur chargement profil:', error);
    }
}

function updateProfileDisplay() {
    if (currentUser) {
        document.getElementById('profile-username').textContent = currentUser.username;
        document.getElementById('xubor-amount').textContent = currentUser.xubor || 0;
        
        // Mettre à jour l'avatar
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.avatar || 'default'}`;
        document.getElementById('profile-avatar').src = avatarUrl;
    }
}

// Chargement des jeux
async function loadGames() {
    try {
        const response = await fetch(`${API_URL}/games`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayGames(data.games || []);
        }
    } catch (error) {
        console.error('Erreur chargement jeux:', error);
    }
}

function displayGames(games) {
    const container = document.querySelector('.games-grid');
    container.innerHTML = '';
    
    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <img src="${game.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop'}" alt="${game.name}">
            <div class="game-info">
                <h3>${game.name}</h3>
                <p>${game.description || 'Jeu passionnant'}</p>
                <div class="game-stats">
                    <span><i class="fas fa-star"></i> ${game.rating || '4.5'}</span>
                    <span><i class="fas fa-users"></i> ${game.play_count || '0'}</span>
                </div>
                <button class="btn btn-small">Jouer</button>
            </div>
        `;
        container.appendChild(gameCard);
    });
}

// Chargement des skins
async function loadSkins() {
    const search = document.getElementById('skin-search').value;
    const rarity = document.getElementById('skin-filter').value;
    
    try {
        const url = new URL(`${API_URL}/skins`);
        if (search) url.searchParams.append('search', search);
        if (rarity && rarity !== 'all') url.searchParams.append('rarity', rarity);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displaySkins(data.skins || []);
        }
    } catch (error) {
        console.error('Erreur chargement skins:', error);
    }
}

function displaySkins(skins) {
    const container = document.querySelector('.skins-grid');
    container.innerHTML = '';
    
    skins.forEach(skin => {
        const skinCard = document.createElement('div');
        skinCard.className = `skin-card ${skin.rarity}`;
        skinCard.innerHTML = `
            <div class="skin-image">
                <i class="fas fa-tshirt"></i>
            </div>
            <div class="skin-info">
                <h3>${skin.name}</h3>
                <p>${skin.description || 'Skin exclusif'}</p>
                <div class="skin-price">
                    <span><i class="fas fa-coins"></i> ${skin.price}</span>
                    ${skin.owned ? 
                        '<span class="owned">✓ Possédé</span>' : 
                        `<button class="btn btn-small buy-skin" data-id="${skin.id}" data-price="${skin.price}">Acheter</button>`
                    }
                </div>
            </div>
        `;
        container.appendChild(skinCard);
    });
    
    // Ajouter les écouteurs pour les boutons d'achat
    document.querySelectorAll('.buy-skin').forEach(button => {
        button.addEventListener('click', (e) => {
            const skinId = e.target.dataset.id;
            const skinPrice = parseInt(e.target.dataset.price);
            purchaseSkin(skinId, skinPrice);
        });
    });
}

// Achat d'un skin
async function purchaseSkin(skinId, price) {
    if (!confirm(`Acheter ce skin pour ${price} Xubor ?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/skins/${skinId}/purchase`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Skin acheté avec succès !');
            currentUser.xubor = data.xubor;
            updateProfileDisplay();
            loadSkins(); // Recharger la liste
        } else {
            alert(data.error || 'Erreur lors de l\'achat');
        }
    } catch (error) {
        console.error('Erreur achat skin:', error);
        alert('Erreur de connexion');
    }
}

// Chargement des amis
async function loadFriends() {
    try {
        const response = await fetch(`${API_URL}/friends`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayFriends(data.friends || []);
            displayFriendRequests(data.pendingRequests || []);
        }
    } catch (error) {
        console.error('Erreur chargement amis:', error);
    }
}

function displayFriends(friends) {
    const container = document.querySelector('.friends-list');
    container.innerHTML = '';
    
    if (friends.length === 0) {
        container.innerHTML = '<p class="empty">Aucun ami pour le moment</p>';
        return;
    }
    
    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.avatar || 'user'}" alt="${friend.username}">
            <div class="friend-info">
                <h4>${friend.username}</h4>
                <span class="status online">En ligne</span>
            </div>
            <button class="btn btn-small"><i class="fas fa-gamepad"></i> Jouer</button>
        `;
        container.appendChild(friendItem);
    });
}

function displayFriendRequests(requests) {
    const container = document.querySelector('.requests-list');
    container.innerHTML = '';
    
    if (requests.length === 0) {
        container.innerHTML = '<p class="empty">Aucune demande en attente</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'friend-request';
        requestItem.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${request.avatar || 'user'}" alt="${request.username}">
            <div class="request-info">
                <h4>${request.username}</h4>
                <span>Veut être votre ami</span>
            </div>
            <div class="request-actions">
                <button class="btn btn-small accept-request" data-id="${request.id}">Accepter</button>
                <button class="btn btn-small reject-request" data-id="${request.id}">Refuser</button>
            </div>
        `;
        container.appendChild(requestItem);
    });
    
    // Ajouter les écouteurs pour les boutons
    document.querySelectorAll('.accept-request').forEach(button => {
        button.addEventListener('click', (e) => {
            const friendId = e.target.dataset.id;
            acceptFriendRequest(friendId);
        });
    });
}

// Gestion des amis
async function sendFriendRequest() {
    const input = document.getElementById('friend-search');
    const username = input.value.trim();
    
    if (!username) {
        alert('Veuillez entrer un pseudo');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/friends/request`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            input.value = '';
            loadFriends(); // Recharger la liste
        } else {
            alert(data.error || 'Erreur lors de l\'envoi de la demande');
        }
    } catch (error) {
        console.error('Erreur envoi demande ami:', error);
        alert('Erreur de connexion');
    }
}

async function acceptFriendRequest(friendId) {
    try {
        const response = await fetch(`${API_URL}/friends/${friendId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Demande d\'ami acceptée');
            loadFriends(); // Recharger la liste
        } else {
            alert(data.error || 'Erreur lors de l\'acceptation');
        }
    } catch (error) {
        console.error('Erreur acceptation demande:', error);
        alert('Erreur de connexion');
    }
}

// Gestion des Xubor
function showPaymentModal(amount, price) {
    const modal = document.getElementById('payment-modal');
    document.getElementById('pack-amount').textContent = amount.toLocaleString();
    document.getElementById('pack-price').textContent = price;
    
    // Déterminer le nom du pack
    let packName = '';
    if (amount === 100) packName = 'Pack Débutant';
    else if (amount === 800) packName = 'Pack Avancé';
    else if (amount === 12095) packName = 'Pack Pro';
    else if (amount === 999999) packName = 'Pack Illimité';
    
    document.getElementById('pack-name').textContent = packName;
    modal.classList.add('active');
}

async function handleXuborPurchase(e) {
    e.preventDefault();
    
    const amount = parseInt(document.getElementById('pack-amount').textContent.replace(/,/g, ''));
    
    // Simulation de paiement - en production, utiliser Stripe ou autre
    if (!confirm(`Confirmer l'achat de ${amount} Xubor ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/xubor/purchase`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Xubor ajoutés à votre compte !');
            currentUser.xubor = data.xubor;
            updateProfileDisplay();
            document.getElementById('payment-modal').classList.remove('active');
            document.getElementById('payment-form').reset();
        } else {
            alert(data.error || 'Erreur lors de l\'achat');
        }
    } catch (error) {
        console.error('Erreur achat Xubor:', error);
        alert('Erreur de connexion');
    }
}

// Recherche globale
function handleGlobalSearch(e) {
    const query = e.target.value.trim();
    
    if (query.length >= 2) {
        // Rechercher dans les jeux
        fetch(`${API_URL}/games/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Afficher les résultats (à implémenter)
            console.log('Résultats recherche:', data.games);
        });
    }
}

// Déconnexion
function handleLogout() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        localStorage.removeItem('xolbor_token');
        localStorage.removeItem('xolbor_user');
        currentUser = null;
        authToken = null;
        showLoginPage();
    }
}

// Fonctions utilitaires
function formatNumber(num) {
    return num.toLocaleString('fr-FR');
}

function getRarityColor(rarity) {
    const colors = {
        common: '#94a3b8',
        rare: '#3b82f6',
        legendary: '#f59e0b',
        exclusive: '#ef4444'
    };
    return colors[rarity] || colors.common;
}

// ===== Modal de jeu intégré =====
function openGameModal(src, title) {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('modal-game-iframe');
    const titleEl = document.getElementById('modal-game-title');
    if (!modal || !iframe) return;
    iframe.src = src;
    titleEl.textContent = title || 'Jeu';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeGameModal() {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('modal-game-iframe');
    if (!modal || !iframe) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    iframe.src = '';
    document.body.style.overflow = '';
}