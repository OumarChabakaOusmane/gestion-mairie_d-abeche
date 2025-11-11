/**
 * Fonction utilitaire pour télécharger un PDF
 * @param {string} type - Type d'acte (naissance, mariage, deces)
 * @param {string} id - ID de l'acte
 * @param {string} [buttonId] - ID du bouton de téléchargement (optionnel)
 * @returns {Promise<void>}
 */
function downloadActePdf(type, id, buttonId = null) {
    if (!id) {
        showAlert('error', 'Erreur', 'ID d\'acte manquant');
        return Promise.reject(new Error('ID d\'acte manquant'));
    }

    // Mettre à jour l'état du bouton si fourni
    const updateButtonState = (isLoading) => {
        if (!buttonId) return;
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            const originalHTML = button.innerHTML;
            button.setAttribute('data-original-html', originalHTML);
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Téléchargement...';
        } else {
            button.disabled = false;
            const originalHTML = button.getAttribute('data-original-html');
            if (originalHTML) {
                button.innerHTML = originalHTML;
            }
        }
    };

    // Récupérer le token JWT
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return Promise.reject(new Error('Non authentifié'));
    }

    // Créer un lien temporaire pour le téléchargement
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);

    // Mettre à jour l'état du bouton
    updateButtonState(true);

    // Construire l'URL de l'API en fonction du type d'acte
    let apiUrl = '';
    switch (type) {
        case 'naissance':
            apiUrl = `/api/actes/naissances/${id}/pdf`;
            break;
        case 'mariage':
            apiUrl = `/api/actes/mariages/${id}/pdf`;
            break;
        case 'deces':
            apiUrl = `/api/actes/deces/${id}/pdf`;
            break;
        default:
            const error = new Error('Type d\'acte non pris en charge');
            error.type = 'UNSUPPORTED_TYPE';
            throw error;
    }

    // Ajouter un timestamp pour éviter le cache
    const url = new URL(apiUrl, window.location.origin);
    url.searchParams.append('_', Date.now());

    return fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        },
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || 'Erreur lors du téléchargement du PDF');
            });
        }
        return response.blob();
    })
    .then(blob => {
        // Créer une URL pour le blob
        const url = window.URL.createObjectURL(blob);
        
        // Configurer le lien de téléchargement
        link.href = url;
        link.download = `${type}-${id}-${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Déclencher le téléchargement
        link.click();
        
        // Nettoyer
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    })
    .catch(error => {
        console.error(`Erreur lors du téléchargement du PDF (${type}):`, error);
        showAlert('error', 'Erreur', error.message || 'Échec du téléchargement du PDF');
        throw error;
    })
    .finally(() => {
        updateButtonState(false);
    });
}

// Fonction utilitaire pour afficher une alerte
function showAlert(type, title, message) {
    // Utiliser la fonction d'alerte existante si disponible
    if (window.showAlert) {
        return window.showAlert(type, title, message);
    }
    
    // Sinon, utiliser une alerte basique
    alert(`[${title}] ${message}`);
}

// Exporter les fonctions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { downloadActePdf, showAlert };
} else {
    window.downloadActePdf = downloadActePdf;
    window.showAlert = showAlert;
}
