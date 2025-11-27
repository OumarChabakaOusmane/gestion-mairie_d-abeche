class UserManager {
    constructor() {
        this.users = [];
        this.connectedUsers = [];
        this.currentUserId = null;
        this.userModal = new bootstrap.Modal(document.getElementById('userModal'));
        this.deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        this.initializeEventListeners();
        this.loadUsers();
        
        // Charger les utilisateurs connectés immédiatement
        this.loadConnectedUsers();
        
        // Mettre à jour la liste des utilisateurs connectés toutes les 30 secondes
        this.connectedUsersInterval = setInterval(() => {
            this.loadConnectedUsers();
        }, 30000);
    }

    initializeEventListeners() {
        // Écouteurs pour les boutons principaux
        const addUserBtn = document.getElementById('addUserBtn');
        const saveUserBtn = document.getElementById('saveUserBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.showUserForm());
        }
        
        if (saveUserBtn) {
            saveUserBtn.addEventListener('click', () => this.saveUser());
        }
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.deleteUser());
        }
        
        // Déléguer les événements pour les boutons dynamiques
        document.addEventListener('click', (e) => {
            // Gérer les clics sur les boutons d'édition
            if (e.target.closest('.edit-user')) {
                const btn = e.target.closest('.edit-user');
                const userId = btn.getAttribute('data-id');
                if (userId) this.editUser(userId);
                e.preventDefault();
            }
            
            // Gérer les clics sur les boutons de suppression
            if (e.target.closest('.delete-user')) {
                const btn = e.target.closest('.delete-user');
                const userId = btn.getAttribute('data-id');
                if (userId) this.confirmDelete(userId);
                e.preventDefault();
            }
        });
    }
    
    // Méthode pour attacher les écouteurs d'événements aux actions des utilisateurs
    attachUserActionListeners() {
        // Les écouteurs sont maintenant gérés de manière déléguée dans initializeEventListeners
        // Cette méthode est conservée pour la rétrocompatibilité
    }
    
    // Méthode pour confirmer la suppression d'un utilisateur
    confirmDelete(userId) {
        if (!userId) return;
        
        const user = this.users.find(u => u._id === userId);
        if (!user) return;
        
        // Mettre à jour la boîte de dialogue de confirmation
        const modal = document.getElementById('deleteConfirmModal');
        if (!modal) return;
        
        const modalTitle = modal.querySelector('.modal-title');
        const modalBody = modal.querySelector('.modal-body');
        const confirmBtn = modal.querySelector('#confirmDeleteBtn');
        
        if (modalTitle) modalTitle.textContent = 'Confirmer la suppression';
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>${user.name || user.email || 'cet utilisateur'}</strong> ?
                    <div class="mt-2">Cette action est irréversible.</div>
                </div>`;
        }
        
        // Stocker l'ID de l'utilisateur à supprimer
        confirmBtn.setAttribute('data-user-id', userId);
        
        // Afficher la boîte de dialogue
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    async loadUsers() {
        try {
            console.log('=== DÉBUT CHARGEMENT UTILISATEURS ===');
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');
            let user = null;
            
            try {
                user = userStr ? JSON.parse(userStr) : null;
                console.log('Utilisateur connecté:', user);
            } catch (e) {
                console.error('Erreur lors du parsing des données utilisateur:', e);
            }
            
            if (!token || !user) {
                const errorMsg = 'Utilisateur non authentifié';
                console.error(errorMsg);
                this.showError(errorMsg);
                window.location.href = '/login';
                return;
            }
            
            // Afficher l'indicateur de chargement
            this.showLoading('Chargement des utilisateurs...');
            
            // Ajouter un délai artificiel pour le débogage
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('Envoi de la requête à /api/users...');
            const startTime = Date.now();
            
            try {
                const response = await fetch('/api/users', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    credentials: 'same-origin'
                });
                
                const responseTime = Date.now() - startTime;
                console.log(`Réponse reçue en ${responseTime}ms - Statut: ${response.status}`);
                
                let data;
                try {
                    data = await response.json();
                    console.log('Données brutes reçues:', data);
                } catch (parseError) {
                    console.error('Erreur lors du parsing de la réponse JSON:', parseError);
                    const text = await response.text();
                    console.error('Réponse brute du serveur:', text);
                    throw new Error('Réponse invalide du serveur');
                }
                
                if (!response.ok) {
                    const errorMsg = data?.message || `Erreur ${response.status}: ${response.statusText}`;
                    console.error('Erreur de l\'API:', errorMsg);
                    throw new Error(errorMsg);
                }
                
                if (data && data.success) {
                    this.users = Array.isArray(data.data) ? data.data : [];
                    console.log(`Nombre d'utilisateurs reçus: ${this.users.length}`);
                    
                    if (this.users.length === 0) {
                        console.warn('Aucun utilisateur trouvé dans la réponse');
                        this.showInfo('Aucun utilisateur trouvé dans la base de données');
                    } else {
                        this.renderUsers();
                    }
                } else {
                    const errorMsg = data?.message || 'Format de réponse inattendu du serveur';
                    console.error('Réponse inattendue:', data);
                    throw new Error(errorMsg);
                }
            } catch (fetchError) {
                console.error('Erreur lors de la récupération des utilisateurs:', fetchError);
                this.showError(`Erreur: ${fetchError.message}`);
            } finally {
                console.log('=== FIN CHARGEMENT UTILISATEURS ===');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors du chargement des utilisateurs: ' + error.message);
        }
    }

    // Méthode utilitaire pour afficher un message d'erreur
    showError(message) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        ${message}
                        <button class="btn btn-sm btn-outline-secondary ms-3" onclick="userManager.loadUsers()">
                            <i class="fas fa-sync-alt me-1"></i> Réessayer
                        </button>
                    </div>
                </td>
            </tr>`;
    }
    
    // Méthode utilitaire pour afficher un message d'information
    showInfo(message) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        ${message}
                    </div>
                </td>
            </tr>`;
    }
    
    // Méthode utilitaire pour afficher un indicateur de chargement
    showLoading(message = 'Chargement en cours...') {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="d-flex justify-content-center align-items-center py-3">
                        <div class="spinner-border text-primary me-2" role="status">
                            <span class="visually-hidden">Chargement...</span>
                        </div>
                        <span>${message}</span>
                    </div>
                </td>
            </tr>`;
    }
    
    // Méthode pour charger les utilisateurs connectés
    async loadConnectedUsers() {
        try {
            console.log('=== DÉBUT loadConnectedUsers ===');
            console.log('1. Vérification du token...');
            const token = localStorage.getItem('token');
            if (!token) {
                const errorMsg = 'Aucun token trouvé dans le localStorage';
                console.error(errorMsg);
                this.showError('Erreur d\'authentification. Veuillez vous reconnecter.');
                return;
            }
            console.log('2. Token trouvé');

            // Vérifier que l'URL est correcte
            const apiUrl = '/api/users/connected';
            console.log('3. Envoi de la requête à:', apiUrl);
            
            // Afficher un indicateur de chargement
            const tbody = document.getElementById('connectedUsersTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">
                            <div class="d-flex justify-content-center align-items-center py-3">
                                <div class="spinner-border text-primary me-2" role="status">
                                    <span class="visually-hidden">Chargement...</span>
                                </div>
                                <span>Chargement des utilisateurs connectés...</span>
                            </div>
                        </td>
                    </tr>`;
            }

            console.log('4. Configuration de la requête...');
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            };
            console.log('5. Options de la requête:', JSON.stringify(fetchOptions, null, 2));

            console.log('6. Envoi de la requête...');
            const response = await fetch(apiUrl, fetchOptions);
            console.log('7. Réponse reçue - Statut:', response.status, response.statusText);
            
            // Vérifier si la réponse est OK (statut 200-299)
            if (response.ok) {
                console.log('8. La réponse est OK, traitement des données...');
                let data;
                try {
                    data = await response.json();
                    console.log('9. Données JSON reçues:', data);
                    
                    if (data && data.success !== undefined) {
                        if (Array.isArray(data.data)) {
                            console.log(`10. ${data.data.length} utilisateurs connectés trouvés`);
                            this.renderConnectedUsers(data.data);
                        } else {
                            console.error('11. Format de données inattendu (data n\'est pas un tableau):', data);
                            this.showError('Format de données inattendu du serveur');
                        }
                    } else {
                        console.error('12. Réponse du serveur invalide (propriété success manquante):', data);
                        this.showError('Réponse du serveur invalide');
                    }
                } catch (jsonError) {
                    console.error('13. Erreur lors du parsing de la réponse JSON:', jsonError);
                    const textResponse = await response.text();
                    console.error('14. Réponse brute du serveur:', textResponse);
                    this.showError('Erreur lors de la lecture des données du serveur');
                }
            } else {
                // Gérer les erreurs HTTP
                console.error('15. Erreur de l\'API - Statut:', response.status);
                let errorMessage = `Erreur ${response.status}`;
                
                try {
                    const errorData = await response.json();
                    console.error('16. Détails de l\'erreur:', errorData);
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    const textResponse = await response.text();
                    console.error('17. Réponse d\'erreur brute:', textResponse);
                    errorMessage = textResponse || errorMessage;
                }

                this.showConnectedUsersError(`Erreur lors du chargement des utilisateurs: ${errorMessage}`);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des utilisateurs connectés:', error);
            this.showConnectedUsersError('Impossible de charger les utilisateurs connectés. Vérifiez votre connexion et réessayez.');
        }
    }

    // Méthode pour afficher un message d'erreur dans le tableau des utilisateurs connectés
    showConnectedUsersError(message) {
        const tbody = document.getElementById('connectedUsersTableBody');
        if (!tbody) {
            console.error('Impossible d\'afficher l\'erreur: élément connectedUsersTableBody non trouvé');
            return;
        }
        
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-3">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                    <button class="btn btn-sm btn-outline-secondary ms-3" onclick="userManager.loadConnectedUsers()">
                        <i class="fas fa-sync-alt me-1"></i> Réessayer
                    </button>
                </td>
            </tr>`;
    }

    // Méthode pour afficher les utilisateurs connectés
    renderConnectedUsers(connectedUsers) {
        console.log('=== DÉBUT renderConnectedUsers ===');
        console.log('Données reçues:', connectedUsers);
        
        const tbody = document.getElementById('connectedUsersTableBody');
        if (!tbody) {
            console.error('Élément connectedUsersTableBody non trouvé dans le DOM');
            return;
        }
        
        // Vérifier que connectedUsers est un tableau
        if (!Array.isArray(connectedUsers)) {
            console.error('Erreur: connectedUsers n\'est pas un tableau', connectedUsers);
            this.showConnectedUsersError('Erreur: données invalides reçues du serveur');
            return;
        }
        
        // Mettre à jour la liste des utilisateurs connectés
        this.connectedUsers = Array.isArray(connectedUsers) ? connectedUsers : [];

        if (this.connectedUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-3">
                        <i class="fas fa-users-slash me-2"></i>
                        Aucun utilisateur connecté pour le moment
                    </td>
                </tr>`;
            return;
        }

        // Trier les utilisateurs par date de dernière activité (du plus récent au plus ancien)
        const sortedUsers = [...this.connectedUsers].sort((a, b) => {
            return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
        });

        // Vider le tableau
        tbody.innerHTML = '';

        // Ajouter chaque utilisateur au tableau
        sortedUsers.forEach(user => {
            const row = document.createElement('tr');
            
            // Formater la date de dernière activité
            const lastActivity = user.lastActivity ? new Date(user.lastActivity) : new Date();
            const formattedDate = lastActivity.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Créer la ligne du tableau
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar me-2">
                            <i class="fas fa-user-circle fs-4 text-primary"></i>
                        </div>
                        <div>
                            <div class="fw-semibold">${user.name || 'Non renseigné'}</div>
                            <small class="text-muted">${user.email || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>
                    <span class="badge bg-${user.role === 'admin' ? 'primary' : 'secondary'}">
                        ${this.formatRole(user.role || 'user')}
                    </span>
                </td>
                <td>${formattedDate}</td>
                <td>
                    <span class="badge bg-success">
                        <i class="fas fa-circle me-1"></i> En ligne
                    </span>
                </td>
            `;
            
            tbody.appendChild(row);
        });

    }
    
    // Méthode pour nettoyer les ressources (à appeler lors de la destruction du composant)
    destroy() {
        if (this.connectedUsersInterval) {
            clearInterval(this.connectedUsersInterval);
            this.connectedUsersInterval = null;
        }
    }
    
    renderUsers() {
        console.log('Début du rendu des utilisateurs');
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            console.error('Élément tbody#usersTableBody non trouvé dans le DOM');
            return;
        }
        
        try {
            // Vider le contenu du tableau
            tbody.innerHTML = '';
            
            // Vérifier s'il y a des utilisateurs à afficher
            if (!Array.isArray(this.users) || this.users.length === 0) {
                console.log('Aucun utilisateur à afficher');
                this.showInfo('Aucun utilisateur trouvé dans la base de données');
                return;
            }

            // Afficher chaque utilisateur
            this.users.forEach((user, index) => {
                try {
                    if (!user || typeof user !== 'object') {
                        console.warn('Données utilisateur invalides:', user);
                        return;
                    }
                    
                    const tr = document.createElement('tr');
                    tr.className = 'align-middle';
                    
                    // Formater la date de création
                    let formattedDate = 'N/A';
                    try {
                        if (user.createdAt) {
                            const date = new Date(user.createdAt);
                            if (!isNaN(date.getTime())) {
                                formattedDate = date.toLocaleDateString('fr-FR', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            }
                        }
                    } catch (dateError) {
                        console.error('Erreur de formatage de la date:', dateError);
                    }
                    
                    // Formater le rôle
                    const formatRole = (role) => {
                        if (!role) return 'N/A';
                        return role
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');
                    };
                    
                    tr.innerHTML = `
                        <td>${index + 1}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="me-2">
                                    <div class="avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" 
                                         style="width: 36px; height: 36px; font-size: 0.9rem;">
                                        ${user.name ? user.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                </div>
                                <div>
                                    <div class="fw-medium">${user.name || 'N/A'}</div>
                                    <small class="text-muted">${user._id || ''}</small>
                                </div>
                            </div>
                        </td>
                        <td>${user.email || 'N/A'}</td>
                        <td>
                            <span class="badge bg-${user.role === 'admin' ? 'danger' : 'primary'}">
                                ${formatRole(user.role)}
                            </span>
                        </td>
                        <td>${formattedDate}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-outline-primary edit-user" 
                                        data-id="${user._id || ''}" 
                                        title="Modifier"
                                        ${!user._id ? 'disabled' : ''}>
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-user" 
                                        data-id="${user._id || ''}" 
                                        title="Supprimer"
                                        ${!user._id ? 'disabled' : ''}>
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    
                    tbody.appendChild(tr);
                    
                } catch (error) {
                    console.error('Erreur lors du rendu de l\'utilisateur:', error, user);
                }
            });
            
            // Ajouter les écouteurs d'événements pour les boutons
            this.attachUserActionListeners();
            
        } catch (error) {
            console.error('Erreur critique lors du rendu des utilisateurs:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Une erreur est survenue lors du chargement des utilisateurs.
                        <button class="btn btn-sm btn-outline-secondary ms-3" onclick="userManager.loadUsers()">
                            <i class="fas fa-sync-alt me-1"></i> Réessayer
                        </button>
                    </td>
                </tr>`;
        }

        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                this.editUser(userId);
            });
        });

        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                this.confirmDelete(userId);
            });
        });
    }

    showUserForm(user = null) {
        const form = document.getElementById('userForm');
        const modalTitle = document.getElementById('userModalLabel');
        const passwordField = document.getElementById('passwordField');
        
        if (user) {
            modalTitle.textContent = 'Modifier l\'utilisateur';
            document.getElementById('userId').value = user._id;
            document.getElementById('name').value = user.name;
            document.getElementById('email').value = user.email;
            document.getElementById('role').value = user.role;
            passwordField.style.display = 'none';
        } else {
            modalTitle.textContent = 'Ajouter un utilisateur';
            form.reset();
            passwordField.style.display = 'block';
            document.getElementById('password').required = true;
        }
        
        this.userModal.show();
    }

    async saveUser() {
        const form = document.getElementById('userForm');
        const userId = document.getElementById('userId').value;
        const isEdit = !!userId;
        
        const userData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            role: document.getElementById('role').value
        };

        const password = document.getElementById('password').value;
        if (password) {
            userData.password = password;
        }

        try {
            const url = isEdit ? `/api/users/${userId}` : '/api/users';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la sauvegarde');
            }

            this.userModal.hide();
            this.loadUsers();
            alert(`Utilisateur ${isEdit ? 'mis à jour' : 'créé'} avec succès!`);
            
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        }
    }

    editUser(userId) {
        const user = this.users.find(u => u._id === userId);
        if (user) {
            this.showUserForm(user);
        }
    }

    confirmDelete(userId) {
        this.currentUserId = userId;
        this.deleteModal.show();
    }

    async deleteUser() {
        if (!this.currentUserId) return;

        try {
            const response = await fetch(`/api/users/${this.currentUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la suppression');
            }

            this.deleteModal.hide();
            this.loadUsers();
            alert('Utilisateur supprimé avec succès!');
            
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression: ' + error.message);
        }
    }
}

// Fonction pour vérifier si un élément est visible dans le viewport
function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Vérifier périodiquement si la section est visible
function checkIfSectionIsVisible() {
    const section = document.querySelector('#connectedUsersTable');
    if (section && isElementInViewport(section)) {
        console.log('La section des utilisateurs connectés est maintenant visible');
        if (window.userManager) {
            console.log('Chargement des utilisateurs connectés...');
            window.userManager.loadConnectedUsers();
        }
        // Arrêter de vérifier une fois que la section est chargée
        clearInterval(visibilityCheckInterval);
    }
}

// Démarrer la vérification de visibilité
let visibilityCheckInterval;
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('=== DÉBUT CHARGEMENT PAGE UTILISATEURS ===');
        console.log('1. Vérification de l\'utilisateur connecté...');
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            console.error('Aucune donnée utilisateur trouvée dans le localStorage');
            window.location.href = '/login';
            return;
        }

        const user = JSON.parse(userStr);
        console.log('Utilisateur connecté:', user);
        
        if (!user.role || user.role !== 'admin') {
            console.warn('Accès refusé: rôle insuffisant', user.role);
            window.location.href = '/dashboard';
            return;
        }

        // Fonction pour initialiser la section des utilisateurs connectés
        const initConnectedUsersSection = () => {
            console.log('Recherche de la section des utilisateurs connectés...');
            const connectedUsersSection = document.querySelector('#connectedUsersTable');
            
            if (!connectedUsersSection) {
                console.warn('La section des utilisateurs connectés n\'est pas encore disponible, nouvel essai dans 100ms...');
                setTimeout(initConnectedUsersSection, 100);
                return;
            }

            console.log('✅ Section des utilisateurs connectés trouvée dans le DOM');
            
            // Initialiser le gestionnaire d'utilisateurs
            window.userManager = new UserManager();
            console.log('Gestionnaire d\'utilisateurs initialisé');

            // Charger immédiatement les utilisateurs connectés
            console.log('Chargement des utilisateurs connectés...');
            window.userManager.loadConnectedUsers();

            // Configurer un intervalle pour rafraîchir périodiquement la liste
            const refreshInterval = setInterval(() => {
                console.log('Rafraîchissement de la liste des utilisateurs connectés...');
                window.userManager.loadConnectedUsers();
            }, 30000); // Toutes les 30 secondes

            // Nettoyer l'intervalle lors du déchargement de la page
            window.addEventListener('beforeunload', () => {
                clearInterval(refreshInterval);
            });
        };

        // Démarrer l'initialisation
        setTimeout(initConnectedUsersSection, 0);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        alert('Une erreur est survenue lors du chargement de la page. Veuillez vous reconnecter.');
        window.location.href = '/login';
    }
});
