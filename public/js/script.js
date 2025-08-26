document.addEventListener('DOMContentLoaded', () => {
  // Gestion de tous les formulaires
  const forms = {
    'formNaissance': 'naissance',
    'formMariage': 'mariage',
    'formDeces': 'deces'
  };

  Object.keys(forms).forEach(formId => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
      
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

          const response = await fetch('/api/actes', {
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
        }
      });
    }
  });
});