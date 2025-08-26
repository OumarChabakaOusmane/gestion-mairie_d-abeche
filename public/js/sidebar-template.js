// Template de sidebar réutilisable pour toutes les pages
function createSidebar(activePage = '') {
  return `
    <div class="sidebar">
      <div class="text-center mb-4">
        <h4><i class="fas fa-landmark me-2"></i> État Civil Tchad</h4>
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
          <a class="nav-link ${activePage === 'deces' ? 'active' : ''}" href="/deces">
            <i class="fas fa-cross me-2"></i> Actes de Décès
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
const commonCSS = `
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
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login';
    return null;
  }
  return token;
}

// Fonction pour faire des requêtes API authentifiées
async function apiRequest(url, options = {}) {
  const token = checkAuth();
  if (!token) return null;
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    const result = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        logout();
        return null;
      }
      throw new Error(result.error || 'Erreur API');
    }
    
    return result;
  } catch (error) {
    console.error('Erreur API:', error);
    alert(error.message);
    return null;
  }
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
