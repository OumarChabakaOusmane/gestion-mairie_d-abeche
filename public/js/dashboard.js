class Dashboard {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isLoading = false;
    this.abortController = null;
    this.refreshHandler = this.handleRefresh.bind(this);
    this.actes = [];
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      this.showError('Erreur lors de l\'initialisation du tableau de bord');
    }
  }

  async loadData() {
    // Éviter les appels multiples simultanés
    if (this.isLoading) {
      return;
    }

    // Limiter les tentatives
    if (this.retryCount >= this.maxRetries) {
      throw new Error('Trop de tentatives échouées');
    }

    this.isLoading = true;
    this.showLoadingState();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Annuler la requête précédente si elle existe
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      // Charger les statistiques
      const [statsResponse, actesResponse] = await Promise.all([
        fetch('/api/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: this.abortController.signal
        }),
        fetch('/api/dashboard/recent-actes?limit=5', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: this.abortController.signal
        })
      ]);

      // Vérifier les réponses
      if (!statsResponse.ok || !actesResponse.ok) {
        const statsError = await statsResponse.json().catch(() => ({}));
        const actesError = await actesResponse.json().catch(() => ({}));
        throw new Error(statsError.error || actesError.error || 'Erreur lors du chargement des données');
      }

      const statsData = await statsResponse.json();
      const actesData = await actesResponse.json();

      if (!statsData.success || !actesData.success) {
        throw new Error(statsData.error || actesData.error || 'Données invalides reçues du serveur');
      }

      // Mettre à jour l'interface
      this.updateStats(statsData.data);
      this.actes = Array.isArray(actesData.data) ? actesData.data : [];
      this.applyFilterAndRender();
      
      this.retryCount = 0; // Reset sur succès
    } catch (error) {
      if (error.name !== 'AbortError') {
        this.retryCount++;
        this.showError('Erreur lors du chargement des données');
      }
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  updateStats(stats) {
    if (!stats) return;
    
    // Mettre à jour les compteurs
    const statsElements = {
      'naissances': 'births-count',
      'mariages': 'marriages-count',
      'deces': 'deaths-count',
      'documents': 'documents-count'
    };

    Object.entries(statsElements).forEach(([key, elementId]) => {
      const element = document.getElementById(elementId);
      if (element) {
        if (key === 'documents') {
          element.textContent = (typeof stats.total === 'number' ? stats.total : (stats.documents || 0));
        } else {
          element.textContent = stats[key] || 0;
        }
      }
    });
  }

  updateRecentActivity(actes) {
    if (!actes || !actes.length) return;
    
    const tbody = document.getElementById('recentActesBody');
    if (!tbody) return;

    // Vider le tableau
    tbody.innerHTML = '';
    if (recentActes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun acte pour ce filtre</td></tr>';
      return;
    }

    // Ajouter chaque acte récent
    actes.forEach(acte => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${acte.numeroActe || 'N/A'}</td>
        <td><span class="badge ${this.getTypeBadge(acte.type)}">${this.getTypeLabel(acte.type)}</span></td>
        <td>${this.formatDate(acte.dateActe)}</td>
        <td>${this.getActeDescription(acte)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary view-acte" data-id="${acte._id}">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  getTypeBadge(type) {
    const types = {
      'naissance': 'bg-primary',
      'mariage': 'bg-success',
      'deces': 'bg-dark'
    };
    return types[type] || 'bg-secondary';
  }

  getTypeLabel(type) {
    const labels = {
      'naissance': 'Naissance',
      'mariage': 'Mariage',
      'deces': 'Décès'
    };
    return labels[type] || type;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  }

  getActeDescription(acte) {
    switch(acte.type) {
      case 'naissance':
        return `${acte.details?.prenom || ''} ${acte.details?.nom || ''}`.trim() || 'Nouveau-né';
      case 'mariage':
        return `${acte.details?.conjoint1 || ''} & ${acte.details?.conjointe2 || ''}`.trim() || 'Mariage';
      case 'deces':
        return `${acte.details?.prenom || ''} ${acte.details?.nom || ''}`.trim() || 'Décès';
      default:
        return acte.numeroActe || 'Acte';
    }
  }

  // Méthode de mise à jour des statistiques (définition effective)
  updateStats(stats) {
    if (!stats) return;
    const statsElements = {
      'naissances': 'births-count',
      'mariages': 'marriages-count',
      'deces': 'deaths-count',
      'documents': 'documents-count'
    };
    Object.entries(statsElements).forEach(([key, elementId]) => {
      const element = document.getElementById(elementId);
      if (element) {
        if (key === 'documents') {
          element.textContent = (typeof stats.total === 'number' ? stats.total : (stats.documents || 0));
        } else {
          element.textContent = stats[key] || 0;
        }
      }
    });
    // Mettre à jour le badge "Dernière mise à jour"
    const badge = document.getElementById('lastUpdatedBadge');
    if (badge) {
      const d = stats.lastUpdated ? new Date(stats.lastUpdated) : null;
      const txt = d ? d.toLocaleString('fr-FR') : '—';
      badge.textContent = `MAJ: ${txt}`;
    }
    this.updateProgressBars(stats);
  }

  updateRecentActivity(actes) {
    if (!actes || !Array.isArray(actes)) {
      console.error('Aucun acte reçu ou format invalide:', actes);
      const tbody = document.getElementById('recentActesBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun acte trouvé</td></tr>';
      return;
    }
    
    const tbody = document.getElementById('recentActesBody');
    if (!tbody) {
      console.error('Élément tbody#recentActesBody non trouvé');
      return;
    }
    
    // Trier les actes par date décroissante
    const sortedActes = [...actes].sort((a, b) => 
      new Date(b.dateCreation || b.dateEnregistrement) - new Date(a.dateCreation || a.dateEnregistrement)
    );
    
    // Prendre les 5 premiers actes
    const recentActes = sortedActes.slice(0, 5);
    
    // Vider le tableau
    tbody.innerHTML = '';
    
    // Ajouter chaque acte au tableau
    recentActes.forEach(acte => {
      const row = document.createElement('tr');
      
      // Créer les cellules avec les données de l'acte
      const numeroCell = document.createElement('td');
      numeroCell.textContent = acte.numeroActe || 'N/A';
      
      const typeCell = document.createElement('td');
      const typeBadge = document.createElement('span');
      typeBadge.className = `badge ${this.getTypeBadge(acte.type)}`;
      typeBadge.textContent = this.getTypeLabel(acte.type);
      typeCell.appendChild(typeBadge);
      
      const nomCell = document.createElement('td');
      nomCell.textContent = this.getActeDescription(acte);
      
      const dateCell = document.createElement('td');
      dateCell.textContent = this.formatDate(acte.dateActe || acte.dateEnregistrement);
      
      const actionsCell = document.createElement('td');
      actionsCell.className = 'text-end';
      actionsCell.innerHTML = `
        <button class="btn btn-sm btn-outline-primary view-acte" data-id="${acte._id}">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary edit-acte" data-id="${acte._id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-acte" data-id="${acte._id}" data-numero="${acte.numeroActe || ''}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      // Ajouter les cellules à la ligne
      row.appendChild(numeroCell);
      row.appendChild(typeCell);
      row.appendChild(nomCell);
      row.appendChild(dateCell);
      row.appendChild(actionsCell);
      
      // Ajouter la ligne au tableau
      tbody.appendChild(row);
    });
    
    // Ajouter les gestionnaires d'événements pour les boutons
    this.addActesEventListeners();
  }

  // Méthode pour ajouter les gestionnaires d'événements aux boutons d'action
  addActesEventListeners() {
    // Gestionnaire pour le bouton Voir
    document.querySelectorAll('.view-acte').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) this.viewActe(id);
      });
    });

    // Gestionnaire pour le bouton Modifier
    document.querySelectorAll('.edit-acte').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) this.editActe(id);
      });
    });

    // Gestionnaire pour le bouton Supprimer
    document.querySelectorAll('.delete-acte').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const numero = e.currentTarget.getAttribute('data-numero');
        if (id) this.deleteActe(id, numero);
      });
    });
  }

  // Méthodes pour gérer les actions sur les actes
  async viewActe(id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/actes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erreur lors de la récupération des détails');
      
      const { success, data } = await response.json();
      if (!success) throw new Error('Données invalides reçues');
      
      // Afficher les détails dans une modal
      this.showActeDetails(data);
    } catch (error) {
      console.error('Erreur:', error);
      this.showError('Impossible de charger les détails de l\'acte');
    }
  }

  editActe(id) {
    // Rediriger vers la page d'édition appropriée
    window.location.href = `/actes/edit/${id}`;
  }

  async deleteActe(id, numero) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'acte ${numero || ''} ?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/actes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      
      const { success } = await response.json();
      if (!success) throw new Error('Erreur lors de la suppression');
      
      this.showSuccess('Acte supprimé avec succès');
      this.loadData(); // Recharger les données
    } catch (error) {
      console.error('Erreur:', error);
      this.showError('Impossible de supprimer l\'acte');
    }
  }

  getTypeLabel(type) {
    const labels = {
      naissance: 'Naissances',
      mariage: 'Mariages',
      deces: 'Décès'
    };
    return labels[type] || type;
  }

  showError(error) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
      <strong>Erreur!</strong> ${error.message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.getElementById('alerts-container') || document.body;
    container.prepend(alertDiv);
  }

  setupEventListeners() {
    // Nettoyer les anciens listeners
    this.cleanup();
    
    // Style et débogage du bouton d'actualisation
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      // Style visuel pour le débogage
      refreshBtn.style.border = '2px solid #dc3545';
      refreshBtn.style.padding = '5px';
      
      // Lier le gestionnaire d'événements avec le bon contexte
      this.refreshHandler = this.handleRefresh.bind(this);
      refreshBtn.addEventListener('click', this.refreshHandler);
    } else {
      console.error('Bouton d\'actualisation non trouvé');
    }

    // Filtre par type
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => this.applyFilterAndRender());
    }
  }

  async handleRefresh(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const refreshBtn = document.getElementById('refresh-btn');
    if (!refreshBtn) return;

    // Désactiver le bouton pendant le chargement
    refreshBtn.disabled = true;
    const icon = refreshBtn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
      // Recharger les données
      await this.loadData();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      // Réactiver le bouton
      refreshBtn.disabled = false;
      if (icon) icon.classList.remove('fa-spin');
    }
  }

  cleanup() {
    // Nettoyer les event listeners
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn && this.refreshHandler) {
      refreshBtn.removeEventListener('click', this.refreshHandler);
    }
    
    // Annuler les requêtes en cours
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Afficher un état de chargement simple
  showLoadingState() {
    const tbody = document.getElementById('recentActesBody');
    if (tbody) {
      tbody.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td colspan="5">
            <div class="loading-skeleton" style="height:16px; width:100%"></div>
          </td>
        `;
        tbody.appendChild(tr);
      }
    }
  }

  hideLoadingState() {
    // Rien à faire ici, le rendu réel écrasera le skeleton
  }

  // Applique le filtre sélectionné et rend la table
  applyFilterAndRender() {
    const typeFilter = document.getElementById('typeFilter');
    const selected = typeFilter ? typeFilter.value : 'all';
    const data = this.actes || [];
    const filtered = selected === 'all' ? data : data.filter(a => a.type === selected);
    this.updateRecentActivity(filtered);
  }

  // Met à jour les barres de progression sur les cartes
  updateProgressBars(stats) {
    if (!stats) return;
    const total = (typeof stats.total === 'number' ? stats.total : 0) || 0;
    const safePct = (n) => total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0;
    const map = [
      { key: 'naissances', id: 'births-progress' },
      { key: 'mariages', id: 'marriages-progress' },
      { key: 'deces', id: 'deaths-progress' },
      { key: 'total', id: 'documents-progress' }
    ];
    map.forEach(({ key, id }) => {
      const el = document.getElementById(id);
      if (el) {
        const val = key === 'total' ? total : (stats[key] || 0);
        el.style.width = safePct(val) + '%';
      }
    });
  }

  // Méthode pour nettoyer avant destruction
  destroy() {
    this.cleanup();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-page')) {
    new Dashboard();
  }
});