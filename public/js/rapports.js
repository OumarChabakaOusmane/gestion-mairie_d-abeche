// Fonction pour afficher des messages d'alerte
function showAlert(title, message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        <strong>${title}</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.main-content');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Supprimer l'alerte après 5 secondes
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Données de démonstration (à remplacer par des données réelles de l'API)
    const typeData = {
        labels: ['Naissances', 'Mariages', 'Décès', 'Autres'],
        datasets: [{
            data: [45, 30, 25, 10],
            backgroundColor: [
                '#4e73df',
                '#1cc88a',
                '#e74a3b',
                '#f6c23e'
            ],
            hoverBackgroundColor: [
                '#2e59d9',
                '#17a673',
                '#be2617',
                '#dda20a'
            ],
            borderWidth: 1
        }]
    };

    const monthlyData = {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
        datasets: [{
            label: 'Actes enregistrés',
            data: [12, 19, 15, 25, 22, 30, 35, 40, 30, 28, 25, 20],
            backgroundColor: 'rgba(78, 115, 223, 0.1)',
            borderColor: '#4e73df',
            pointBackgroundColor: '#4e73df',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#4e73df',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.3,
            fill: true
        }]
    };

    // Configuration des graphiques
    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: '#fff',
                titleColor: '#5a5c69',
                bodyColor: '#5a5c69',
                borderColor: '#dddfeb',
                borderWidth: 1,
                padding: 15,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return `${context.label}: ${context.raw} actes`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    display: true,
                    drawOnChartArea: true,
                    drawTicks: false,
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    precision: 0
                }
            },
            x: {
                grid: {
                    display: false,
                    drawOnChartArea: false
                }
            }
        }
    };

    // Initialisation du graphique circulaire (Actes par type)
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    new Chart(typeCtx, {
        type: 'doughnut',
        data: typeData,
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: 'Répartition des actes par type',
                    font: {
                        size: 16
                    },
                    padding: {
                        bottom: 20
                    }
                }
            }
        }
    });

    // Initialisation du graphique en ligne (Actes par mois)
    const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
    new Chart(monthlyCtx, {
        type: 'line',
        data: monthlyData,
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: 'Évolution mensuelle des actes',
                    font: {
                        size: 16
                    },
                    padding: {
                        bottom: 20
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.3
                }
            }
        }
    });

    // Gestion du formulaire d'export
    document.getElementById('exportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitButtons = form.querySelectorAll('button[type="submit"]');
        const format = e.submitter?.value || 'pdf';
        
        // Désactiver les boutons pendant le traitement
        submitButtons.forEach(btn => {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Traitement...';
        });

        try {
            const formData = new FormData(form);
            // S'assurer que le format est correctement défini
            formData.set('format', format);
            
            const params = new URLSearchParams();
            formData.forEach((value, key) => {
                if (value) params.append(key, value);
            });
            
            const response = await fetch(`/api/rapports/export?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': format === 'pdf' ? 'application/pdf' : 'text/csv',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            
            // Vérifier si le blob n'est pas vide
            if (blob.size === 0) {
                throw new Error('Le fichier généré est vide');
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapport_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            
            // Nettoyage
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Afficher un message de succès
            showAlert('Export réussi', 'Le rapport a été généré avec succès.', 'success');
            
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            showAlert('Erreur d\'export', `Une erreur est survenue : ${error.message}`, 'danger');
        } finally {
            // Réactiver les boutons
            submitButtons.forEach(btn => {
                btn.disabled = false;
                btn.innerHTML = format === 'pdf' 
                    ? '<i class="fas fa-file-pdf me-2"></i>Exporter en PDF'
                    : '<i class="fas fa-file-csv me-2"></i>Exporter en CSV';
            });
        }
    });
});
