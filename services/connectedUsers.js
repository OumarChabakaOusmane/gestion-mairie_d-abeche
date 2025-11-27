class ConnectedUsers {
    constructor() {
        this.connectedUsers = new Map(); // userId -> { user, lastActivity, socketId }
    }

    // Ajouter ou mettre à jour un utilisateur connecté
    addOrUpdateUser(user, socketId = null) {
        if (!user || !user._id) return;
        
        this.connectedUsers.set(user._id.toString(), {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            },
            lastActivity: new Date(),
            socketId: socketId
        });
        
        console.log(`Utilisateur connecté/mis à jour: ${user.email}`);
    }

    // Supprimer un utilisateur connecté
    removeUser(userId) {
        if (!userId) return false;
        
        const userIdStr = userId.toString();
        const wasRemoved = this.connectedUsers.delete(userIdStr);
        
        if (wasRemoved) {
            console.log(`Utilisateur déconnecté: ${userIdStr}`);
        }
        
        return wasRemoved;
    }

    // Obtenir tous les utilisateurs connectés
    getAllConnectedUsers() {
        return Array.from(this.connectedUsers.values()).map(entry => ({
            ...entry.user,
            status: 'online',
            lastActivity: entry.lastActivity
        }));
    }

    // Vérifier si un utilisateur est connecté
    isUserConnected(userId) {
        if (!userId) return false;
        return this.connectedUsers.has(userId.toString());
    }

    // Nettoyer les utilisateurs inactifs (plus de X minutes sans activité)
    cleanupInactiveUsers(inactiveMinutes = 30) {
        const now = new Date();
        const inactiveSince = new Date(now.getTime() - (inactiveMinutes * 60 * 1000));
        
        let removedCount = 0;
        
        this.connectedUsers.forEach((value, key) => {
            if (value.lastActivity < inactiveSince) {
                this.connectedUsers.delete(key);
                removedCount++;
            }
        });
        
        if (removedCount > 0) {
            console.log(`Nettoyage des utilisateurs inactifs: ${removedCount} utilisateurs supprimés`);
        }
        
        return removedCount;
    }
}

// Exporter une instance unique de la classe
module.exports = new ConnectedUsers();
