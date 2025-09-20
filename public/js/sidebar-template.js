// Template de sidebar réutilisable pour toutes les pages
window.createSidebar = function(activePage = '') {
  return `
    <div class="sidebar">
      <div class="text-center mb-4">
        <div class="d-flex align-items-center justify-content-center mb-2">
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0MCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iOCIgZmlsbD0iIzAwMjY4RiIvPgogIDxyZWN0IHk9IjgiIHdpZHRoPSI0MCIgaGVpZ2h0PSI4IiBmaWxsPSIjRkZEMTAwIi8+CiAgPHJlY3QgeT0iMTYiIHdpZHRoPSI0MCIgaGVpZ2h0PSI4IiBmaWxsPSIjQ0UxMTI2Ii8+Cjwvc3ZnPgo=" alt="Drapeau du Tchad" class="me-2" style="width: 40px; height: 24px;">
          <i class="fas fa-landmark me-2"></i>
        </div>
        <h4>État Civil Tchad</h4>
      </div>
      <ul class="nav flex-column">
        <li class="nav-item">
          <a class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" href="/dashboard">
            <i class="fas fa-tachometer-alt me-2"></i> Tableau de Bord
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'naissance' ? 'active' : ''}" href="/naissance">
            <i class="fas fa-baby me-2"></i> Actes de Naissance
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'mariage' ? 'active' : ''}" href="/mariage">
            <i class="fas fa-ring me-2"></i> Actes de Mariage
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'divorce' ? 'active' : ''}" href="/divorce">
            <i class="fas fa-heart-broken me-2"></i> Actes de Divorce
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'engagement' ? 'active' : ''}" href="/engagement">
            <i class="fas fa-handshake me-2"></i> Engagements de cial
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'deces' ? 'active' : ''}" href="/deces">
            <i class="fas fa-skull me-2"></i> Actes de Décès
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'calendrier' ? 'active' : ''}" href="/calendrier">
            <i class="fas fa-calendar me-2"></i> Calendrier
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'documents' ? 'active' : ''}" href="/documents">
            <i class="fas fa-file me-2"></i> Documents
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'rapports' ? 'active' : ''}" href="/rapports">
            <i class="fas fa-chart-bar me-2"></i> Rapports
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'messagerie' ? 'active' : ''}" href="/messagerie">
            <i class="fas fa-envelope me-2"></i> Messagerie
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'utilisateurs' ? 'active' : ''}" href="/utilisateurs">
            <i class="fas fa-users me-2"></i> Utilisateurs
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link ${activePage === 'parametres' ? 'active' : ''}" href="/parametres">
            <i class="fas fa-cog me-2"></i> Paramètres
          </a>
        </li>
        <li class="nav-item mt-3">
          <a class="nav-link text-danger" href="#" onclick="logout()">
            <i class="fas fa-sign-out-alt me-2"></i> Déconnexion
          </a>
        </li>
      </ul>
    </div>
  `;
}

// CSS commun pour toutes les pages
window.commonCSS = `
  :root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    --accent-color: #e74c3c;
  }
  
  body {
    background-color: #f8f9fa;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  .sidebar {
    background-color: var(--primary-color);
    color: white;
    height: 100vh;
    position: fixed;
    width: 250px;
    padding-top: 20px;
  }
  
  .sidebar .nav-link {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
  }
  
  .sidebar .nav-link:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sidebar .nav-link.active {
    color: white;
    background-color: var(--secondary-color);
  }
  
  .main-content {
    margin-left: 250px;
    padding: 20px;
  }
`;

// Fonction d'authentification commune
function checkAuth() {
  // Vérifier d'abord dans le localStorage
  let token = localStorage.getItem('token');
  
  // Si pas de token dans le localStorage, vérifier les cookies
  if (!token) {
    const cookies = document.cookie.split(';').reduce((cookies, cookie) => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      cookies[name] = value;
      return cookies;
    }, {});
    
    if (cookies.token) {
      // Stocker le token dans le localStorage pour les prochaines requêtes
      localStorage.setItem('token', cookies.token);
      token = cookies.token;
    }
  }
  
  // Si toujours pas de token, on ne redirige pas immédiatement pour éviter les boucles
  // La redirection sera gérée par la page qui appelle cette fonction
  return token || null;
}

// Fonction pour faire des requêtes API authentifiées
async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token && !options.public) {
    console.warn('Aucun token trouvé, redirection vers la page de connexion');
    window.location.href = '/login';
    return null;
  }

  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    credentials: 'same-origin'
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 secondes
    
    const response = await fetch(url, {
      ...mergedOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Gérer les réponses non-JSON (comme les PDF)
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const result = isJson ? await response.json() : await response.blob();
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Session expirée ou non autorisée, déconnexion...');
        logout();
        return null;
      }
      
      // Gérer les erreurs de validation
      if (response.status === 422) {
        const error = new Error('Erreur de validation');
        error.errors = result.errors || {};
        throw error;
      }
      
      // Autres erreurs
      const error = new Error(result.message || `Erreur ${response.status}: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    
    return result;
  } catch (error) {
    console.error('Erreur API:', {
      url,
      error: error.message,
      status: error.status,
      stack: error.stack
    });
    
    // Afficher un message d'erreur convivial
    if (error.name === 'AbortError') {
      showError('La requête a pris trop de temps. Veuillez réessayer.');
    } else if (error.message.includes('Failed to fetch')) {
      showError('Impossible de se connecter au serveur. Vérifiez votre connexion Internet.');
    } else {
      showError(error.message || 'Une erreur est survenue. Veuillez réessayer.');
    }
    
    return null;
  }
}

// Fonction utilitaire pour afficher les erreurs
function showError(message) {
  // Vérifier si une alerte est déjà affichée
  if (document.querySelector('.error-toast')) return;
  
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.innerHTML = `
    <div class="alert alert-danger alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Supprimer automatiquement après 5 secondes
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Fonction de déconnexion
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// Fonction pour obtenir les informations utilisateur
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}
