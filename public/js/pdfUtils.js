// Cache pour stocker les données préchargées
const pdfCache = new Map();

/**
 * Précache les données du PDF pour un accès plus rapide
 * @param {string} type - Type d'acte
 * @param {string} id - ID de l'acte
 * @returns {Promise<void>}
 */
async function preloadPdfData(type, id) {
    const cacheKey = `${type}-${id}`;
    if (pdfCache.has(cacheKey)) return;
    
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Non authentifié');
    
    const url = new URL(`/${type}s/${id}`, window.location.origin);
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Impossible de charger les données');
    
    const data = await response.json();
    pdfCache.set(cacheKey, data);
}

/**
 * Fonction optimisée pour télécharger un PDF
 * @param {string} type - Type d'acte (naissance, mariage, deces)
 * @param {string} id - ID de l'acte
 * @param {string} [buttonId] - ID du bouton de téléchargement (optionnel)
 * @returns {Promise<void>}
 */
function downloadActePdf(type, id, buttonId = null) {
    // Utiliser requestIdleCallback pour une meilleure performance
    if (window.requestIdleCallback) {
        requestIdleCallback(() => preloadPdfData(type, id).catch(console.error));
    }
    
    return new Promise((resolve, reject) => {
        if (!id) {
            const error = new Error('ID d\'acte manquant');
            showAlert('error', 'Erreur', error.message);
            return reject(error);
        }

        const updateButtonState = (isLoading) => {
            if (!buttonId) return;
            const button = document.getElementById(buttonId);
            if (!button) return;
            
            if (isLoading) {
                button.disabled = true;
                const originalHTML = button.innerHTML;
                button.setAttribute('data-original-html', originalHTML);
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            } else {
                button.disabled = false;
                const originalHTML = button.getAttribute('data-original-html');
                if (originalHTML) button.innerHTML = originalHTML;
            }
        };

        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return reject(new Error('Non authentifié'));
        }

        // Mettre à jour l'état du bouton immédiatement
        updateButtonState(true);

        // Utiliser Web Workers si disponible pour le traitement en arrière-plan
        if (window.Worker) {
            const worker = new Worker('/js/pdf.worker.js');
            worker.postMessage({ type, id, token });
            
            worker.onmessage = (e) => {
                if (e.data.error) {
                    showAlert('error', 'Erreur', e.data.error);
                    updateButtonState(false);
                    worker.terminate();
                    return reject(new Error(e.data.error));
                }
                
                // Traiter la réponse du worker
                handlePdfResponse(e.data, type, id);
                updateButtonState(false);
                worker.terminate();
                resolve();
            };
            
            worker.onerror = (error) => {
                console.error('Worker error:', error);
                updateButtonState(false);
                worker.terminate();
                reject(error);
            };
        } else {
            // Fallback pour les navigateurs sans support des Web Workers
            fetchPdfDirectly(type, id, token)
                .then(() => resolve())
                .catch(reject)
                .finally(() => updateButtonState(false));
        }
    });
}

/**
 * Télécharge directement le PDF sans utiliser de worker
 * @param {string} type - Type d'acte
 * @param {string} id - ID de l'acte
 * @param {string} token - Token JWT
 */
async function fetchPdfDirectly(type, id, token) {
    const url = new URL(`/${type}s/${id}/pdf`, window.location.origin);
    url.searchParams.append('_', Date.now());
    
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors du téléchargement');
    }
    
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
        throw new Error('Le fichier PDF est vide');
    }
    
    return handlePdfResponse(blob, type, id);
}

/**
 * Gère la réponse du PDF téléchargé
 * @param {Blob} blob - Données du PDF
 * @param {string} type - Type d'acte
 * @param {string} id - ID de l'acte
 */
function handlePdfResponse(blob, type, id) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = `${type}-${id}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Nettoyage asynchrone
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }, 100);
}

// Gestionnaire pour l'icône Voir
document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-pdf');
    if (viewBtn) {
        e.preventDefault();
        const acteId = viewBtn.getAttribute('data-acte-id');
        const type = viewBtn.getAttribute('data-acte-type') || 'naissance';
        if (acteId) {
            window.open(`/${type}s/${acteId}/pdf?view=true`, '_blank');
        }
    }
});

// Fonction utilitaire pour afficher une alerte
function showAlert(type, title, message) {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    
    // Créer et afficher une alerte Bootstrap
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        <strong>${title}</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container') || document.body;
    container.prepend(alertDiv);
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Gestionnaire d'événements pour les boutons de téléchargement dans les tableaux
document.addEventListener('click', async (e) => {
    const downloadBtn = e.target.closest('.download-pdf');
    if (downloadBtn) {
        e.preventDefault();
        const acteId = downloadBtn.getAttribute('data-acte-id');
        const type = downloadBtn.getAttribute('data-acte-type') || 'naissance';
        if (acteId) {
            await downloadActePdf(type, acteId, downloadBtn.id || null);
        }
    }
});

// Exporter les fonctions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { downloadActePdf, showAlert };
} else {
    window.downloadActePdf = downloadActePdf;
    window.showAlert = showAlert;
}
