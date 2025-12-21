// friends.js - Système de gestion d'amis

class FriendSystem {
    constructor() {
        this.currentUser = null;
        this.friends = [];
        this.pendingRequests = [];
        this.blockedUsers = [];
        this.init();
    }
    
    async init() {
        await this.loadCurrentUser();
        await this.loadFriendsData();
        this.updateNotificationBadge();
    }
    
    async loadCurrentUser() {
        try {
            const response = await fetch('get_user.php');
            const data = await response.json();
            if (data.success) {
                this.currentUser = data.user;
            } else {
                // Fallback pour la démo
                this.currentUser = {
                    id: 1,
                    username: 'PlayerOne',
                    xuborBalance: 1500,
                    level: 42,
                    xp: 12500,
                    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PlayerOne'
                };
            }
        } catch (error) {
            console.error('Erreur de chargement utilisateur:', error);
            // Fallback pour la démo
            this.currentUser = {
                id: 1,
                username: 'PlayerOne',
                xuborBalance: 1500,
                level: 42,
                xp: 12500,
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PlayerOne'
            };
        }
    }
    
    async loadFriendsData() {
        try {
            const response = await fetch('get_friends.php');
            const data = await response.json();
            if (data.success) {
                this.friends = data.friends || [];
                this.pendingRequests = data.pendingRequests || [];
                this.blockedUsers = data.blockedUsers || [];
            } else {
                // Données de démonstration
                this.generateDemoData();
            }
        } catch (error) {
            console.error('Erreur de chargement des amis:', error);
            // Données de démonstration
            this.generateDemoData();
        }
    }
    
    generateDemoData() {
        // Amis de démonstration
        this.friends = [
            {
                id: 2,
                username: 'AlexPro',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexPro',
                status: 'online',
                level: 35,
                xp: 8900,
                lastSeen: 'En ligne maintenant',
                currentGame: 'Dragon\'s Realm',
                isFavorite: true
            },
            {
                id: 3,
                username: 'SarahGamer',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahGamer',
                status: 'gaming',
                level: 28,
                xp: 7200,
                lastSeen: 'En jeu depuis 45 min',
                currentGame: 'Galaxy Conquest'
            },
            {
                id: 4,
                username: 'MikeLegend',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MikeLegend',
                status: 'offline',
                level: 56,
                xp: 21500,
                lastSeen: 'Vu il y a 2 heures'
            }
        ];
        
        // Demandes en attente
        this.pendingRequests = [
            {
                id: 1,
                fromUserId: 5,
                fromUsername: 'LunaStar',
                fromAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LunaStar',
                timestamp: Date.now() - 3600000
            }
        ];
        
        // Utilisateurs bloqués
        this.blockedUsers = [
            {
                id: 6,
                username: 'TrollMaster',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TrollMaster',
                blockedSince: Date.now() - 86400000
            }
        ];
    }
    
    async searchUsers(query) {
        try {
            const response = await fetch(`search_users.php?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success) {
                return data.users;
            }
            return [];
        } catch (error) {
            console.error('Erreur de recherche:', error);
            // Simulation de recherche
            return this.simulateSearch(query);
        }
    }
    
    simulateSearch(query) {
        const allUsers = [
            { id: 2, username: 'AlexPro', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexPro' },
            { id: 3, username: 'SarahGamer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahGamer' },
            { id: 4, username: 'MikeLegend', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MikeLegend' },
            { id: 5, username: 'LunaStar', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LunaStar' },
            { id: 7, username: 'TomChampion', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TomChampion' },
            { id: 8, username: 'EmmaWarrior', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=EmmaWarrior' }
        ];
        
        return allUsers.filter(user => 
            user.username.toLowerCase().includes(query.toLowerCase()) &&
            user.id !== this.currentUser.id
        );
    }
    
    async sendFriendRequest(targetUsername) {
        try {
            const formData = new FormData();
            formData.append('username', targetUsername);
            
            const response = await fetch('add_friend.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                this.pendingRequests.push({
                    id: Date.now(),
                    toUserId: data.userId,
                    toUsername: targetUsername,
                    timestamp: Date.now()
                });
                
                this.updateNotificationBadge();
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur d\'envoi de demande:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async acceptFriendRequest(requestId) {
        try {
            const formData = new FormData();
            formData.append('request_id', requestId);
            
            const response = await fetch('accept_friend.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                const requestIndex = this.pendingRequests.findIndex(r => r.id == requestId);
                if (requestIndex !== -1) {
                    const request = this.pendingRequests[requestIndex];
                    this.pendingRequests.splice(requestIndex, 1);
                    
                    // Ajouter comme ami
                    this.friends.push({
                        id: request.fromUserId,
                        username: request.fromUsername,
                        avatar: request.fromAvatar,
                        status: 'online',
                        level: Math.floor(Math.random() * 100) + 1,
                        xp: Math.floor(Math.random() * 10000),
                        lastSeen: 'En ligne maintenant',
                        isFavorite: false
                    });
                }
                
                this.updateNotificationBadge();
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur d\'acceptation:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async declineFriendRequest(requestId) {
        try {
            const formData = new FormData();
            formData.append('request_id', requestId);
            
            const response = await fetch('decline_friend.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                this.pendingRequests = this.pendingRequests.filter(r => r.id != requestId);
                this.updateNotificationBadge();
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur de refus:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async removeFriend(friendId) {
        try {
            const formData = new FormData();
            formData.append('friend_id', friendId);
            
            const response = await fetch('remove_friend.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                this.friends = this.friends.filter(f => f.id != friendId);
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur de suppression:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async blockUser(userId) {
        try {
            const formData = new FormData();
            formData.append('user_id', userId);
            
            const response = await fetch('block_user.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                const user = this.friends.find(f => f.id == userId) || 
                            this.pendingRequests.find(r => r.fromUserId == userId);
                
                if (user) {
                    this.friends = this.friends.filter(f => f.id != userId);
                    this.pendingRequests = this.pendingRequests.filter(r => r.fromUserId != userId);
                    
                    this.blockedUsers.push({
                        id: userId,
                        username: user.username || user.fromUsername,
                        avatar: user.avatar || user.fromAvatar,
                        blockedSince: Date.now()
                    });
                }
                
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur de blocage:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async unblockUser(userId) {
        try {
            const formData = new FormData();
            formData.append('user_id', userId);
            
            const response = await fetch('unblock_user.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                this.blockedUsers = this.blockedUsers.filter(b => b.id != userId);
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Erreur de déblocage:', error);
            return { success: false, message: 'Erreur réseau' };
        }
    }
    
    async toggleFavorite(friendId) {
        try {
            const formData = new FormData();
            formData.append('friend_id', friendId);
            
            const response = await fetch('toggle_favorite.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Mettre à jour les données locales
                const friend = this.friends.find(f => f.id == friendId);
                if (friend) {
                    friend.isFavorite = !friend.isFavorite;
                }
                return { success: true };
            } else {
                return { success: false };
            }
        } catch (error) {
            console.error('Erreur de favori:', error);
            // Simuler le changement en local
            const friend = this.friends.find(f => f.id == friendId);
            if (friend) {
                friend.isFavorite = !friend.isFavorite;
            }
            return { success: true };
        }
    }
    
    getStats() {
        const online = this.friends.filter(f => f.status === 'online').length;
        const gaming = this.friends.filter(f => f.status === 'gaming').length;
        const offline = this.friends.filter(f => f.status === 'offline').length;
        
        return {
            online,
            gaming,
            offline,
            total: this.friends.length,
            pending: this.pendingRequests.length,
            blocked: this.blockedUsers.length
        };
    }
    
    getSuggestions() {
        // Suggestions basées sur les amis d'amis
        const allUsers = this.simulateSearch('');
        const suggestions = allUsers.filter(user => 
            !this.friends.some(f => f.id === user.id) &&
            !this.pendingRequests.some(r => r.fromUserId === user.id) &&
            !this.blockedUsers.some(b => b.id === user.id)
        ).slice(0, 5);
        
        return suggestions.map(user => ({
            ...user,
            mutualFriends: Math.floor(Math.random() * 5) + 1
        }));
    }
    
    updateNotificationBadge() {
        const badge = document.getElementById('request-count');
        if (badge) {
            badge.textContent = this.pendingRequests.length;
            badge.style.display = this.pendingRequests.length > 0 ? 'flex' : 'none';
        }
    }
}

// Initialisation globale
let friendSystem = null;
let activeTab = 'all';

// Fonctions utilitaires
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
    const toast = document.getElementById('notification-toast');
    const title = document.getElementById('notification-title');
    const msg = document.getElementById('notification-message');
    
    toast.className = 'notification-toast';
    toast.classList.add(type);
    
    switch(type) {
        case 'success':
            title.textContent = 'Succès';
            break;
        case 'error':
            title.textContent = 'Erreur';
            break;
        default:
            title.textContent = 'Information';
    }
    
    msg.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    if (typeof authManager !== 'undefined' && !authManager.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }
    
    friendSystem = new FriendSystem();
    await friendSystem.init();
    
    // Initialiser l'interface
    loadUserData();
    loadFriends();
    loadSuggestions();
    updateStats();
    
    // Configurer la recherche
    const searchInput = document.getElementById('friend-search');
    searchInput.addEventListener('input', debounce(function(e) {
        if (e.target.value.length >= 2) {
            searchUsers(e.target.value);
        } else {
            hideSearchResults();
        }
    }, 300));
    
    // Configurer les onglets
    document.querySelectorAll('.friends-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            activeTab = this.dataset.tab;
            filterFriends();
        });
    });
    
    // Configurer le bouton ajouter ami
    document.getElementById('add-friend-btn').addEventListener('click', function() {
        const username = prompt('Entrez le pseudo de l\'ami à ajouter :');
        if (username && username.length >= 3) {
            addFriend(username);
        } else if (username) {
            showNotification('Pseudo trop court (minimum 3 caractères)', 'error');
        }
    });
    
    // Fermer la recherche en cliquant ailleurs
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-bar')) {
            hideSearchResults();
        }
    });
});

// Fonctions d'interface
function loadUserData() {
    if (!friendSystem.currentUser) return;
    
    const user = friendSystem.currentUser;
    document.getElementById('xubor-balance').textContent = 
        (user.xuborBalance || 0).toLocaleString();
    
    const avatarImg = document.querySelector('.avatar img');
    if (avatarImg && user.avatar) {
        avatarImg.src = user.avatar;
    }
}

function loadFriends() {
    filterFriends();
}

async function searchUsers(query) {
    const users = await friendSystem.searchUsers(query);
    const container = document.getElementById('search-results');
    
    if (users.length === 0) {
        container.innerHTML = '<div class="search-result-item">Aucun utilisateur trouvé</div>';
        container.classList.add('active');
        return;
    }
    
    const friends = friendSystem.friends;
    const pending = friendSystem.pendingRequests;
    
    container.innerHTML = users.map(user => {
        const isFriend = friends.some(f => f.id == user.id);
        const hasPendingRequest = pending.some(r => r.fromUserId == user.id);
        
        return `
            <div class="search-result-item ${isFriend ? 'already-friend' : ''}" 
                 onclick="${!isFriend ? `addFriend('${user.username}')` : ''}">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.avatar}" alt="${user.username}" style="width: 30px; height: 30px; border-radius: 50%;">
                    <span>${user.username}</span>
                </div>
                ${isFriend ? 
                    '<span style="color: var(--primary); font-size: 12px;">Déjà ami</span>' : 
                    hasPendingRequest ?
                    '<span style="color: var(--warning); font-size: 12px;">Demande envoyée</span>' :
                    '<button class="btn-add" style="padding: 5px 10px; font-size: 12px;">Ajouter</button>'
                }
            </div>
        `;
    }).join('');
    
    container.classList.add('active');
}

function hideSearchResults() {
    document.getElementById('search-results').classList.remove('active');
}

async function addFriend(username) {
    const result = await friendSystem.sendFriendRequest(username);
    showNotification(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
        hideSearchResults();
        document.getElementById('friend-search').value = '';
        filterFriends();
        updateStats();
        loadSuggestions();
    }
}

async function acceptFriendRequest(requestId) {
    const result = await friendSystem.acceptFriendRequest(requestId);
    showNotification(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
        filterFriends();
        updateStats();
        loadSuggestions();
        hideFriendRequests();
    }
}

async function declineFriendRequest(requestId) {
    if (confirm('Refuser cette demande d\'ami ?')) {
        const result = await friendSystem.declineFriendRequest(requestId);
        showNotification(result.message, result.success ? 'info' : 'error');
        
        if (result.success) {
            filterFriends();
            updateStats();
            hideFriendRequests();
        }
    }
}

async function removeFriend(friendId) {
    if (confirm('Retirer cet ami de votre liste ?')) {
        const result = await friendSystem.removeFriend(friendId);
        showNotification(result.message, result.success ? 'info' : 'error');
        
        if (result.success) {
            filterFriends();
            updateStats();
        }
    }
}

async function blockUser(userId) {
    if (confirm('Bloquer cet utilisateur ? Il ne pourra plus vous envoyer de messages ni de demandes d\'ami.')) {
        const result = await friendSystem.blockUser(userId);
        showNotification(result.message, result.success ? 'info' : 'error');
        
        if (result.success) {
            filterFriends();
            updateStats();
        }
    }
}

async function unblockUser(userId) {
    const result = await friendSystem.unblockUser(userId);
    showNotification(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
        filterFriends();
        updateStats();
    }
}

async function toggleFavorite(friendId) {
    const result = await friendSystem.toggleFavorite(friendId);
    if (result.success) {
        filterFriends();
        showNotification('Favori modifié', 'info');
    }
}

function showFriendRequests() {
    const modal = document.getElementById('friend-request-modal');
    const container = document.getElementById('requests-list');
    const noRequests = document.getElementById('no-requests');
    
    const requests = friendSystem.pendingRequests;
    
    if (requests.length === 0) {
        container.style.display = 'none';
        noRequests.style.display = 'block';
    } else {
        container.style.display = 'block';
        noRequests.style.display = 'none';
        
        container.innerHTML = requests.map(request => `
            <div class="request-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${request.fromAvatar}" 
                         alt="${request.fromUsername}" 
                         style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <strong>${request.fromUsername}</strong>
                        <p style="font-size: 12px; opacity: 0.7;">
                            Demande reçue il y a ${Math.floor((Date.now() - request.timestamp) / 3600000)}h
                        </p>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn-accept" onclick="acceptFriendRequest('${request.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-decline" onclick="declineFriendRequest('${request.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    modal.classList.add('active');
}

function hideFriendRequests() {
    document.getElementById('friend-request-modal').classList.remove('active');
}

function filterFriends() {
    const searchTerm = document.getElementById('friend-search').value.toLowerCase();
    const container = document.getElementById('friends-list');
    
    let friendsToShow = [];
    
    switch (activeTab) {
        case 'all':
            friendsToShow = friendSystem.friends;
            break;
        case 'online':
            friendsToShow = friendSystem.friends.filter(f => f.status === 'online');
            break;
        case 'pending':
            friendsToShow = friendSystem.pendingRequests.map(req => ({
                id: req.fromUserId,
                username: req.fromUsername,
                avatar: req.fromAvatar,
                status: 'offline',
                isPending: true,
                requestId: req.id
            }));
            break;
        case 'blocked':
            friendsToShow = friendSystem.blockedUsers.map(user => ({
                ...user,
                status: 'blocked',
                isBlocked: true
            }));
            break;
    }
    
    // Appliquer la recherche
    if (searchTerm) {
        friendsToShow = friendsToShow.filter(friend => 
            friend.username.toLowerCase().includes(searchTerm)
        );
    }
    
    displayFriends(friendsToShow);
}

function displayFriends(friendList) {
    const container = document.getElementById('friends-list');
    
    if (friendList.length === 0) {
        container.innerHTML = `
            <div class="no-friends">
                <i class="fas fa-user-friends"></i>
                <h3>Aucun ami trouvé</h3>
                <p>${activeTab === 'all' ? 'Ajoutez des amis pour commencer' : 
                    activeTab === 'online' ? 'Aucun ami en ligne' :
                    activeTab === 'pending' ? 'Aucune demande en attente' :
                    'Aucun utilisateur bloqué'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = friendList.map(friend => `
        <div class="friend-card" data-friend-id="${friend.id}">
            <div class="friend-avatar" onclick="viewFriend3D('${friend.username}')">
                <img src="${friend.avatar}" alt="${friend.username}">
                <div class="status-indicator ${friend.status}"></div>
                ${friend.isFavorite ? '<div class="favorite-badge"><i class="fas fa-star"></i></div>' : ''}
            </div>
            
            <div class="friend-info">
                <div class="friend-main">
                    <h3>${friend.username}</h3>
                    <span class="friend-status-text ${friend.status}">
                        <i class="fas fa-circle"></i>
                        ${friend.status === 'online' ? 'En ligne' : 
                         friend.status === 'gaming' ? 'En jeu' : 
                         friend.status === 'blocked' ? 'Bloqué' : 'Hors ligne'}
                    </span>
                </div>
                
                <div class="friend-details">
                    ${friend.currentGame ? `
                        <p class="friend-game">
                            <i class="fas fa-gamepad"></i> ${friend.currentGame}
                        </p>
                    ` : ''}
                    <p class="friend-last-seen">
                        ${friend.lastSeen || ''}
                    </p>
                </div>
                
                <div class="friend-actions">
                    ${friend.isPending ? `
                        <button class="btn-accept" onclick="acceptFriendRequest('${friend.requestId}')">
                            <i class="fas fa-check"></i> Accepter
                        </button>
                        <button class="btn-decline" onclick="declineFriendRequest('${friend.requestId}')">
                            <i class="fas fa-times"></i> Refuser
                        </button>
                    ` : friend.isBlocked ? `
                        <button class="btn-unblock" onclick="unblockUser('${friend.id}')">
                            <i class="fas fa-ban"></i> Débloquer
                        </button>
                    ` : `
                        <button class="btn-message" onclick="messageFriend('${friend.id}')">
                            <i class="fas fa-comment"></i> Message
                        </button>
                        <button class="btn-profile" onclick="viewFriendProfile('${friend.id}')">
                            <i class="fas fa-user"></i> Profil
                        </button>
                        ${friend.status === 'gaming' ? `
                            <button class="btn-join" onclick="joinFriendGame('${friend.id}')">
                                <i class="fas fa-gamepad"></i> Rejoindre
                            </button>
                        ` : ''}
                        <button class="btn-favorite" onclick="toggleFavorite('${friend.id}')">
                            <i class="fas ${friend.isFavorite ? 'fa-star' : 'fa-star'}"></i>
                        </button>
                        <button class="btn-remove-friend" onclick="removeFriend('${friend.id}')">
                            <i class="fas fa-user-times"></i>
                        </button>
                        <button class="btn-block" onclick="blockUser('${friend.id}')">
                            <i class="fas fa-ban"></i>
                        </button>
                    `}
                </div>
            </div>
            
            ${friend.level ? `
                <div class="friend-xp">
                    <div class="xp-level">Niv. ${friend.level}</div>
                    <div class="xp-bar">
                        <div class="xp-progress" style="width: ${(friend.xp % 1000) / 10}%"></div>
                    </div>
                    <div class="xp-text">${friend.xp} XP</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function loadSuggestions() {
    const suggestions = friendSystem.getSuggestions();
    displaySuggestions(suggestions);
}

function displaySuggestions(suggestions) {
    const container = document.getElementById('suggestions-list');
    
    if (suggestions.length === 0) {
        container.innerHTML = '<p class="no-suggestions">Aucune suggestion pour le moment</p>';
        return;
    }
    
    container.innerHTML = suggestions.map(suggestion => `
        <div class="suggestion-card">
            <div class="suggestion-avatar">
                <img src="${suggestion.avatar}" alt="${suggestion.username}">
            </div>
            <div class="suggestion-info">
                <h4>${suggestion.username}</h4>
                <p>${suggestion.mutualFriends} amis en commun</p>
            </div>
            <button class="btn-add" onclick="addFriend('${suggestion.username}')">
                <i class="fas fa-user-plus"></i>
            </button>
        </div>
    `).join('');
}

function refreshSuggestions() {
    loadSuggestions();
    showNotification('Suggestions actualisées', 'info');
}

function updateStats() {
    const stats = friendSystem.getStats();
    
    document.getElementById('online-count').textContent = stats.online;
    document.getElementById('offline-count').textContent = stats.offline;
    document.getElementById('gaming-count').textContent = stats.gaming;
    document.getElementById('total-count').textContent = stats.total;
    document.getElementById('pending-count').textContent = stats.pending;
    document.getElementById('blocked-count').textContent = stats.blocked;
}

function viewFriend3D(username) {
    const viewer = document.getElementById('avatar-3d-viewer');
    viewer.innerHTML = `
        <div class="avatar-3d">
            <div class="avatar-model" id="avatar-model">
                <i class="fas fa-user-astronaut"></i>
            </div>
            <div class="avatar-info">
                <h3>${username}</h3>
                <p>Visualisation 3D de l'avatar</p>
            </div>
        </div>
    `;
    
    const model = document.getElementById('avatar-model');
    const rotationSlider = document.getElementById('rotation-slider');
    const zoomSlider = document.getElementById('zoom-slider');
    
    rotationSlider.addEventListener('input', function() {
        model.style.transform = `rotateY(${this.value}deg) scale(${zoomSlider.value})`;
    });
    
    zoomSlider.addEventListener('input', function() {
        model.style.transform = `rotateY(${rotationSlider.value}deg) scale(${this.value})`;
    });
    
    model.style.transform = `rotateY(${rotationSlider.value}deg) scale(${zoomSlider.value})`;
}

function reset3DView() {
    document.getElementById('rotation-slider').value = 0;
    document.getElementById('zoom-slider').value = 1.5;
    
    const model = document.getElementById('avatar-model');
    if (model) {
        model.style.transform = 'rotateY(0deg) scale(1.5)';
    }
}

function messageFriend(friendId) {
    const friend = friendSystem.friends.find(f => f.id == friendId);
    if (!friend) return;
    
    const message = prompt(`Envoyer un message à ${friend.username} :`);
    if (message) {
        showNotification(`Message envoyé à ${friend.username}`, 'success');
    }
}

function viewFriendProfile(friendId) {
    const friend = friendSystem.friends.find(f => f.id == friendId);
    if (!friend) return;
    
    showNotification(`Ouverture du profil de ${friend.username}...`, 'info');
}

function joinFriendGame(friendId) {
    const friend = friendSystem.friends.find(f => f.id == friendId);
    if (!friend) return;
    
    if (confirm(`Rejoindre ${friend.username} dans ${friend.currentGame} ?`)) {
        showNotification(`Connexion à ${friend.currentGame}...`, 'info');
    }
}
