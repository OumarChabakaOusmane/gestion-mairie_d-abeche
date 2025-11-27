// Fonction utilitaire pour vérifier si l'utilisateur est administrateur
function isAdmin() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    const user = JSON.parse(userStr);
    return user && user.role === 'admin';
  } catch (error) {
    console.error('Erreur lors de la vérification du rôle administrateur:', error);
    return false;
  }
}

class Dashboard {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isLoading = false;
    this.abortController = null;
    this.refreshHandler = this.handleRefresh.bind(this);
    this.actes = [];
    this.currentPage = 1;
    this.itemsPerPage = 10; // Nombre d'actes par page
    this.filteredActes = [];
    this.init();
  }

  async init() {
    try {
      // Initialiser la barre latérale
      const sidebarContainer = document.getElementById('sidebar-container');
      if (sidebarContainer && typeof createSidebar === 'function') {
        sidebarContainer.innerHTML = createSidebar('dashboard');
        // Appliquer les styles de la barre latérale
        const style = document.createElement('style');
        style.textContent = window.commonCSS;
        document.head.appendChild(style);
      }
      
      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du tableau de bord:', error);
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
        fetch('/api/actes?limit=100', {
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
      
      // Log pour déboguer la structure des données
      console.log('Données brutes des actes reçues:', actesData);
      if (this.actes.length > 0) {
        console.log('Premier acte:', this.actes[0]);
        console.log('Types d\'actes uniques:', [...new Set(this.actes.map(a => a.type))]);
      }
      
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
    const tbody = document.getElementById('recentActesBody');
    if (!tbody) return;

    // Vider le tableau
    tbody.innerHTML = '';
    
    if (!actes || actes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun acte trouvé</td></tr>';
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
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucun acte trouvé</td></tr>';
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
      const typeCell = document.createElement('td');
      const nomCell = document.createElement('td');
      const dateCell = document.createElement('td');
      const actionsCell = document.createElement('td');
      
      // Remplir les cellules
      numeroCell.textContent = acte.numeroActe || 'N/A';
      typeCell.innerHTML = `<span class="badge ${this.getTypeBadge(acte.type)}">${this.getTypeLabel(acte.type)}</span>`;
      nomCell.textContent = this.getActeDescription(acte);
      dateCell.textContent = this.formatDate(acte.dateActe || acte.dateCreation || acte.dateEnregistrement);
      
      // Créer un conteneur pour les boutons d'action
      const btnGroup = document.createElement('div');
      btnGroup.className = 'd-flex justify-content-end align-items-center gap-1';
      
      // Créer les boutons d'action avec des classes personnalisées
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn btn-sm btn-action btn-view';
      viewBtn.setAttribute('data-id', acte._id);
      viewBtn.setAttribute('title', 'Voir les détails');
      viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-action btn-edit';
      editBtn.setAttribute('data-id', acte._id);
      editBtn.setAttribute('title', 'Modifier');
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-action btn-delete';
      deleteBtn.setAttribute('data-id', acte._id);
      deleteBtn.setAttribute('data-numero', acte.numeroActe || '');
      deleteBtn.setAttribute('title', 'Supprimer');
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      
      // Ajouter les boutons au groupe
      btnGroup.appendChild(viewBtn);
      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(deleteBtn);
      
      // Ajouter le groupe de boutons à la cellule
      actionsCell.className = 'text-end';
      actionsCell.appendChild(btnGroup);
      
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
    // Délégation d'événements pour gérer les boutons dynamiques
    document.addEventListener('click', async (e) => {
      // Gestionnaire pour le bouton Voir
      const viewBtn = e.target.closest('.btn-view');
      if (viewBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        // Ajouter une classe d'animation
        viewBtn.classList.add('btn-action', 'btn-view');
        
        const id = viewBtn.getAttribute('data-id');
        if (id) {
          // Sauvegarder le contenu original
          const originalContent = viewBtn.innerHTML;
          
          // Afficher le spinner et désactiver le bouton
          viewBtn.disabled = true;
          viewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          try {
            await this.viewActe(id);
          } catch (error) {
            console.error('Erreur lors de la visualisation:', error);
            // Afficher une notification d'erreur
            this.showError('Erreur lors du chargement des détails');
          } finally {
            // Restaurer le bouton à son état initial
            if (viewBtn) {
              viewBtn.disabled = false;
              viewBtn.innerHTML = originalContent;
              
              // Ajouter un effet de retour
              viewBtn.style.transform = 'scale(0.95)';
              setTimeout(() => {
                if (viewBtn) {
                  viewBtn.style.transform = '';
                }
              }, 200);
            }
          }
        }
        return;
      }

      // Gestionnaire pour le bouton Modifier
      const editBtn = e.target.closest('.btn-edit');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        // Ajouter une classe d'animation
        editBtn.classList.add('btn-action', 'btn-edit');
        
        const id = editBtn.getAttribute('data-id');
        if (id) {
          // Sauvegarder le contenu original
          const originalContent = editBtn.innerHTML;
          
          // Afficher le spinner et désactiver le bouton
          editBtn.disabled = true;
          editBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          try {
            await this.editActe(id);
          } catch (error) {
            console.error('Erreur lors de la préparation de l\'édition:', error);
            // Afficher une notification d'erreur
            this.showError('Erreur lors du chargement du formulaire d\'édition');
            
            // Restaurer le bouton après un délai
            setTimeout(() => {
              if (editBtn) {
                editBtn.disabled = false;
                editBtn.innerHTML = originalContent;
                
                // Ajouter un effet de secousse en cas d'erreur
                editBtn.style.animation = 'shake 0.5s';
                setTimeout(() => {
                  if (editBtn) editBtn.style.animation = '';
                }, 500);
              }
            }, 1000);
          }
        }
        return;
      }

      // Gestionnaire pour le bouton Supprimer
      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        // Ajouter une classe d'animation
        deleteBtn.classList.add('btn-action', 'btn-delete');
        
        const id = deleteBtn.getAttribute('data-id');
        const numero = deleteBtn.getAttribute('data-numero');
        
        if (id) {
          // Demander confirmation avant de supprimer
          if (!confirm(`Êtes-vous sûr de vouloir supprimer l'acte ${numero || ''} ?`)) {
            // Animation d'annulation
            deleteBtn.style.transform = 'translateX(10px)';
            setTimeout(() => {
              if (deleteBtn) deleteBtn.style.transform = '';
            }, 200);
            return;
          }
          
          // Sauvegarder le contenu original
          const originalContent = deleteBtn.innerHTML;
          
          // Afficher le spinner et désactiver le bouton
          deleteBtn.disabled = true;
          deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          try {
            await this.deleteActe(id, numero);
          } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            // Afficher une notification d'erreur
            this.showError('Erreur lors de la suppression');
            
            // Restaurer le bouton après un délai
            setTimeout(() => {
              if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = originalContent;
                
                // Ajouter un effet de secousse en cas d'erreur
                deleteBtn.style.animation = 'shake 0.5s';
                setTimeout(() => {
                  if (deleteBtn) deleteBtn.style.animation = '';
                }, 500);
              }
            }, 1000);
          }
        }
      }
    });
  }

  // Méthodes pour gérer les actions sur les actes
  async viewActe(id) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      const response = await fetch(`/api/actes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la récupération des détails');
      }
      
      const { success, data } = await response.json();
      if (!success || !data) throw new Error('Données invalides reçues du serveur');
      
      // Afficher les détails dans une modal
      this.showActeDetails(data);
      
      // Retourner une promesse résolue pour le finally
      return Promise.resolve();
      
    } catch (error) {
      console.error('Erreur lors de la visualisation:', error);
      this.showError(error.message || 'Impossible de charger les détails de l\'acte');
      return Promise.reject(error);
    }
  }

  showActeDetails(acte) {
    // Créer le contenu de la modal en fonction du type d'acte
    let modalContent = '';
    
    switch(acte.type) {
      case 'naissance':
        modalContent = `
          <h5>Acte de Naissance</h5>
          <p><strong>Numéro:</strong> ${acte.numeroActe || 'N/A'}</p>
          <p><strong>Nom:</strong> ${acte.details?.nom || ''}</p>
          <p><strong>Prénom:</strong> ${acte.details?.prenom || ''}</p>
          <p><strong>Date de naissance:</strong> ${this.formatDate(acte.dateActe)}</p>
          <p><strong>Lieu de naissance:</strong> ${acte.details?.lieuNaissance || 'Non spécifié'}</p>
        `;
        break;
        
      case 'mariage':
        modalContent = `
          <h5>Acte de Mariage</h5>
          <p><strong>Numéro:</strong> ${acte.numeroActe || 'N/A'}</p>
          <p><strong>Conjoint 1:</strong> ${acte.details?.conjoint1 || 'Non spécifié'}</p>
          <p><strong>Conjoint 2:</strong> ${acte.details?.conjointe2 || 'Non spécifié'}</p>
          <p><strong>Date du mariage:</strong> ${this.formatDate(acte.dateActe)}</p>
        `;
        break;
        
      case 'deces':
        modalContent = `
          <h5>Acte de Décès</h5>
          <p><strong>Numéro:</strong> ${acte.numeroActe || 'N/A'}</p>
          <p><strong>Défunt(e):</strong> ${acte.details?.prenom || ''} ${acte.details?.nom || ''}</p>
          <p><strong>Date de décès:</strong> ${this.formatDate(acte.dateActe)}</p>
          <p><strong>Lieu de décès:</strong> ${acte.details?.lieuDeces || 'Non spécifié'}</p>
        `;
        break;
        
      default:
        modalContent = '<p>Détails non disponibles pour ce type d\'acte.</p>';
    }
    
    // Créer et afficher la modal
    const modalId = 'acteDetailsModal';
    let modal = document.getElementById(modalId);
    
    // Si la modal n'existe pas, la créer
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Détails de l'acte</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              ${modalContent}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
              <button type="button" class="btn btn-primary" id="downloadPdfBtn" data-id="${acte._id}" data-type="${acte.type}">
                <i class="fas fa-download me-1"></i> Télécharger le PDF
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Ajouter un écouteur d'événement pour le bouton de téléchargement
      modal.addEventListener('click', (e) => {
        if (e.target.closest('#downloadPdfBtn')) {
          const btn = e.target.closest('#downloadPdfBtn');
          const id = btn.getAttribute('data-id');
          const type = btn.getAttribute('data-type');
          this.downloadActePdf(id, type);
        }
      });
    } else {
      // Mettre à jour le contenu de la modal existante
      modal.querySelector('.modal-body').innerHTML = modalContent;
      const downloadBtn = modal.querySelector('#downloadPdfBtn');
      if (downloadBtn) {
        downloadBtn.setAttribute('data-id', acte._id);
        downloadBtn.setAttribute('data-type', acte.type);
      }
    }
    
    // Afficher la modal
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modalInstance = new bootstrap.Modal(modal);
      modalInstance.show();
    } else {
      console.error('Bootstrap Modal non chargé');
      // Fallback simple si Bootstrap n'est pas disponible
      modal.style.display = 'block';
      modal.style.background = 'rgba(0,0,0,0.5)';
    }
  }

  async editActe(id) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return Promise.reject('Non authentifié');
      }
      
      // Récupérer les détails de l'acte pour déterminer son type
      const response = await fetch(`/api/actes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Impossible de charger les détails de l\'acte');
      }
      
      const { success, data } = await response.json();
      if (!success || !data) throw new Error('Données invalides reçues du serveur');
      
      // Rediriger vers la page d'édition appropriée en fonction du type d'acte
      const type = data.type || 'actes';
      
      // Rediriger vers la page d'édition avec les paramètres
      window.location.href = `/edit-acte?id=${id}&type=${type}`;
      
      // Retourner une promesse qui ne se résout jamais pour éviter les erreurs
      return new Promise(() => {});
      
    } catch (error) {
      console.error('Erreur lors de la préparation de l\'édition:', error);
      this.showError(error.message || 'Impossible de charger la page d\'édition');
      
      // Propage l'erreur pour le gestionnaire d'événements
      return Promise.reject(error);
    }
  }

  async deleteActe(id, numero) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return Promise.reject('Non authentifié');
      }
      
      const response = await fetch(`/api/actes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de la suppression');
      }
      
      const { success, message } = await response.json();
      if (!success) throw new Error(message || 'Erreur lors de la suppression');
      
      // Afficher un message de succès
      this.showSuccess(message || 'Acte supprimé avec succès');
      
      // Recharger les données après un court délai pour laisser voir le message
      setTimeout(() => {
        this.loadData();
      }, 1000);
      
      return Promise.resolve();
      
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      this.showError(error.message || 'Impossible de supprimer l\'acte');
      return Promise.reject(error);
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

  async downloadActePdf(id, type) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Afficher un indicateur de chargement
      const button = document.querySelector(`#downloadPdfBtn[data-id="${id}"]`);
      const originalText = button ? button.innerHTML : '';
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Génération...';
      }

      // Appeler l'API pour générer le PDF
      const response = await fetch(`/api/actes/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acte-${type}-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Erreur lors du téléchargement du PDF:', error);
      this.showError('Impossible de télécharger le PDF. Veuillez réessayer.');
    } finally {
      // Restaurer le bouton
      const button = document.querySelector(`#downloadPdfBtn[data-id="${id}"]`);
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-download me-1"></i> Télécharger le PDF';
      }
    }
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
    
    // Bouton d'actualisation - Supprimé car non utilisé

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
    const selected = typeFilter ? typeFilter.value.toLowerCase().trim() : 'all';
    
    // Mappage des types d'actes avec leurs variantes possibles
    const typeMap = {
      'naissance': ['naissance', 'naiss', 'n', 'birth'],
      'mariage': ['mariage', 'mariages', 'm', 'marriage'],
      'deces': ['deces', 'décès', 'd', 'decede', 'mort', 'decedee']
    };

    // Fonction pour normaliser le type d'acte
    const normalizeType = (type) => {
      if (!type) return '';
      return String(type).toLowerCase().trim()
        .replace(/é|è|ê|ë/g, 'e')
        .replace(/à|â|ä/g, 'a')
        .replace(/î|ï/g, 'i')
        .replace(/ô|ö/g, 'o')
        .replace(/ù|û|ü/g, 'u');
    };

    // Si 'tous' est sélectionné, afficher tous les actes
    if (selected === 'all') {
      this.filteredActes = [...this.actes];
    } else {
      // Sinon, filtrer les actes selon le type sélectionné
      this.filteredActes = this.actes.filter(acte => {
        if (!acte.type) return false;
        
        const acteType = normalizeType(acte.type);
        const validTypes = typeMap[selected] || [selected];
        
        // Vérifier si le type de l'acte correspond à l'un des types valides
        return validTypes.some(validType => 
          acteType.includes(validType) || validType.includes(acteType)
        );
      });
    }
    
    // Mettre à jour l'interface
    this.currentPage = 1;
    this.updatePagination();
    this.updateRecentActivity(this.getPaginatedActes());
    
    // Afficher un message si aucun résultat
    const noResultsMessage = document.getElementById('noResultsMessage');
    if (noResultsMessage) {
      noResultsMessage.style.display = this.filteredActes.length === 0 ? 'block' : 'none';
    }
  }

  getPaginatedActes() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredActes.slice(start, end); // Correction: Utiliser start et end pour la pagination
  }

  updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalItems = this.filteredActes.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);
    
    let paginationHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="text-muted">
          Affichage de <b>${startItem}</b> à <b>${endItem}</b> sur <b>${totalItems}</b> actes
        </div>
        <div class="btn-group">
          <button class="btn btn-outline-primary btn-sm" ${this.currentPage === 1 ? 'disabled' : ''} 
                  onclick="window.dashboardInstance.goToPage(${this.currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Précédent
          </button>
          <button class="btn btn-outline-primary btn-sm" ${this.currentPage >= totalPages ? 'disabled' : ''} 
                  onclick="window.dashboardInstance.goToPage(${this.currentPage + 1})">
            Suivant <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;
    
    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    if (page < 1 || page > Math.ceil(this.filteredActes.length / this.itemsPerPage)) return;
    this.currentPage = page;
    this.updateRecentActivity(this.getPaginatedActes());
    this.updatePagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const dashboardPage = document.getElementById('dashboard-page');
  if (dashboardPage) {
    window.dashboardInstance = new Dashboard();
  }
});