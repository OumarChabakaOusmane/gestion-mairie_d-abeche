class Dashboard {
  constructor() {
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
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/actes', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const { success, data, error } = await response.json();
      if (!success) throw new Error(error);

      this.updateDashboard(data);
    } catch (error) {
      throw error;
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
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-page')) {
    new Dashboard();
  }
});