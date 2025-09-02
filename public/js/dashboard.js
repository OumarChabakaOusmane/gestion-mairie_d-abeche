class Dashboard {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isLoading = false;
    this.abortController = null;
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
    } catch (error) {
      this.showError(error);
      console.error('Dashboard init error:', error);
    }
  }

  async loadData() {
    // Éviter les appels multiples simultanés
    if (this.isLoading) {
      console.warn('Load already in progress');
      return;
    }

    // Limiter les tentatives
    if (this.retryCount >= this.maxRetries) {
      throw new Error('Trop de tentatives échouées');
    }

    this.isLoading = true;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      // Annuler la requête précédente si elle existe
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      const response = await fetch('/api/actes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: this.abortController.signal,
        // Timeout de 10 secondes
        timeout: 10000
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const { success, data, error } = await response.json();
      if (!success) throw new Error(error);

      this.updateDashboard(data);
      this.retryCount = 0; // Reset sur succès
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      
      this.retryCount++;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  updateDashboard(actes) {
    this.updateStats(actes);
    this.updateRecentActivity(actes);
    this.updateCharts(actes);
  }

  updateStats(actes) {
    const stats = {
      naissance: actes.filter(a => a.type === 'naissance').length,
      mariage: actes.filter(a => a.type === 'mariage').length,
      deces: actes.filter(a => a.type === 'deces').length
    };

    // Update counters
    Object.entries(stats).forEach(([type, count]) => {
      const element = document.getElementById(`${type}-count`);
      if (element) element.textContent = count.toLocaleString();
    });

    // Update progress bars
    const goals = { naissance: 1500, mariage: 600, deces: 400 };
    Object.entries(goals).forEach(([type, goal]) => {
      const percent = Math.min(Math.round((stats[type] / goal) * 100), 100);
      const progressBar = document.getElementById(`${type}-progress`);
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
      }
    });
  }

  updateRecentActivity(actes) {
    const periods = {
      '7j': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      '20j': new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      '60j': new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    };

    const tableBody = document.querySelector('#recentActesTable tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ['naissance', 'mariage', 'deces'].map(type => {
      const counts = Object.entries(periods).map(([_, date]) => 
        actes.filter(a => a.type === type && new Date(a.dateEnregistrement) >= date).length
      );

      return `
        <tr>
          <td>${this.getTypeLabel(type)}</td>
          ${counts.map(count => `<td>${count}</td>`).join('')}
        </tr>
      `;
    }).join('');
  }

  updateCharts(actes) {
    // Initialize charts using Chart.js or similar library
    if (typeof Chart !== 'undefined') {
      this.initTypeDistributionChart(actes);
      this.initMonthlyTrendChart(actes);
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
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      this.refreshHandler = () => this.loadData();
      refreshBtn.addEventListener('click', this.refreshHandler);
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