// Configuration globale
const CONFIG = {
  REQUEST_TIMEOUT: 10000, // 10 secondes
  MAX_RETRIES: 3
};

// Utilitaire pour fetch avec timeout
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Requête expirée (timeout)');
    }
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Gestion de tous les formulaires
  const forms = {
    'formNaissance': 'naissance',
    'formMariage': 'mariage',
    'formDeces': 'deces'
  };

  const formHandlers = new Map(); // Stocker les handlers pour nettoyage

  Object.keys(forms).forEach(formId => {
    const form = document.getElementById(formId);
    if (form) {
      const handler = async (e) => {
        e.preventDefault();
        
        // Éviter les soumissions multiples
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.disabled) return;
        
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enregistrement...';
        }
      
        const type = forms[formId];
        const formData = new FormData(form);
        const details = Object.fromEntries(formData);
        const mairie = formData.get('mairie');
        
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            window.location.href = '/login';
            return;
          }

          const response = await fetchWithTimeout('/api/demandes-actes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, details, mairie })
          });

          const result = await response.json();
          const resultDiv = document.getElementById('result');
          
          if (response.ok) {
            resultDiv.innerHTML = `
              <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                ${result.message}
                <div class="mt-2">
                  <strong>Numéro d'acte:</strong> ${result.data.numeroActe}
                </div>
              </div>
            `;
            form.reset();
          } else {
            throw new Error(result.error || 'Erreur lors de l\'enregistrement');
          }
        } catch (err) {
          document.getElementById('result').innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-circle me-2"></i>
              ${err.message}
            </div>
          `;
        } finally {
          // Réactiver le bouton
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer';
          }
        }
      };
      
      form.addEventListener('submit', handler);
      formHandlers.set(formId, { form, handler });
    }
  });

  // Nettoyage lors du déchargement de la page
  window.addEventListener('beforeunload', () => {
    formHandlers.forEach(({ form, handler }) => {
      form.removeEventListener('submit', handler);
    });
    formHandlers.clear();
  });
});