// Worker pour le téléchargement des PDF en arrière-plan
self.onmessage = async function(e) {
    const { type, id, token } = e.data;
    
    try {
        const url = new URL(`/${type}s/${id}/pdf`, self.location.origin);
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
        
        // Renvoyer le blob au thread principal
        self.postMessage(blob);
    } catch (error) {
        self.postMessage({ error: error.message || 'Erreur inconnue' });
    }
};
