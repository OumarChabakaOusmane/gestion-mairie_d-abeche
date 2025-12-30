// Configuration du calendrier
class CalendrierManager {
    constructor() {
        this.calendar = null;
        this.initializeCalendar();
        this.setupEventListeners();
        this.setupNotifications();
        
        // Gestion de la déconnexion
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                window.location.href = '/login.html';
            });
        }
    }
    
    // Afficher les informations de l'utilisateur connecté
    displayUserInfo() {
        try {
            const userInfo = JSON.parse(localStorage.getItem('user'));
            const userInfoElement = document.getElementById('user-info');
            
            if (userInfo && userInfoElement) {
                const { nom, prenom, role } = userInfo;
                userInfoElement.innerHTML = `
                    <div class="user-avatar">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="user-details">
                        <div class="user-name">${prenom} ${nom}</div>
                        <div class="user-role badge bg-primary">${role || 'Utilisateur'}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erreur lors du chargement des informations utilisateur:', error);
        }
    }
    
    // Obtenir la couleur d'un événement en fonction de son type
    getEventColor(eventType) {
        const colors = {
            'naissance': '#4CAF50',  // Vert
            'mariage': '#2196F3',    // Bleu
            'deces': '#9E9E9E',      // Gris
            'general': '#9C27B0'     // Violet par défaut
        };
        return colors[eventType?.toLowerCase()] || colors['general'];
    }
    
    // Obtenir la couleur de bordure d'un événement
    getEventBorderColor(eventType) {
        const colors = {
            'naissance': '#388E3C',  // Vert foncé
            'mariage': '#1976D2',    // Bleu foncé
            'deces': '#616161',      // Gris foncé
            'general': '#7B1FA2'     // Violet foncé par défaut
        };
        return colors[eventType?.toLowerCase()] || colors['general'];
    }

    // Initialisation du calendrier
    initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'fr',
            firstDay: 1, // Lundi comme premier jour de la semaine
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            buttonText: {
                today: 'Aujourd\'hui',
                month: 'Mois',
                week: 'Semaine',
                day: 'Jour',
                list: 'Liste'
            },
            allDaySlot: false,
            nowIndicator: true,
            navLinks: true,
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: 3, // Limite le nombre d'événements affichés par jour
            dayMaxEventRows: true, // Affiche un indicateur quand il y a trop d'événements
            dayPopoverFormat: { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            },
            moreLinkContent: function(args) {
                return { html: '<span>+ ' + args.num + ' de plus</span>' };
            },
            views: {
                dayGridMonth: {
                    dayMaxEventRows: 4, // Ajuste le nombre de lignes d'événements par jour
                    dayMaxEvents: 3
                },
                timeGridWeek: {
                    dayMaxEvents: 5
                },
                timeGridDay: {
                    dayMaxEvents: 10
                }
            },
            eventTimeFormat: {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            },
            // Gestion des événements
            events: this.loadEvents.bind(this),
            eventClick: this.handleEventClick.bind(this),
            dateClick: this.handleDateClick.bind(this),
            eventDrop: this.handleEventDrop.bind(this),
            eventResize: this.handleEventResize.bind(this),
            eventDidMount: this.handleEventDidMount.bind(this),
            eventContent: this.renderEventContent.bind(this)
        });

        this.calendar.render();
        this.setupSearch();
    }

    // Chargement des événements depuis l'API
    async loadEvents(fetchInfo, successCallback, failureCallback) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            // Afficher l'indicateur de chargement
            const loadingIndicator = document.getElementById('loading-indicator');
            const errorMessage = document.getElementById('error-message');
            
            if (loadingIndicator) loadingIndicator.style.display = 'block';
            if (errorMessage) errorMessage.style.display = 'none';

            // Appel à l'API pour récupérer les événements
            const response = await fetch(`/api/calendrier?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Erreur lors du chargement des événements');
            }
            
            const data = await response.json();
            
            // Affichage des données de débogage (désactivé en production)
            const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isDevelopment) {
                console.log('Données du calendrier chargées :', data.events?.length || 0, 'événements');
            }
            
            // Vérifier si la réponse contient des événements
            if (!data.success || !Array.isArray(data.events)) {
                console.error('Format de réponse invalide ou pas d\'événements', data);
                throw new Error('Format de réponse invalide');
            }
            
            // Formater les événements pour FullCalendar
            const formattedEvents = data.events.map(event => {
                // S'assurer que la date de début est un objet Date valide
                const start = event.start ? new Date(event.start) : new Date();
                
                return {
                    id: event.id,
                    title: event.title,
                    start: start,
                    allDay: event.allDay !== false, // Par défaut à true
                    color: event.color,
                    backgroundColor: this.getEventColor(event.extendedProps?.type || 'general'),
                    borderColor: this.getEventBorderColor(event.extendedProps?.type || 'general'),
                    textColor: '#ffffff',
                    extendedProps: {
                        ...event.extendedProps,
                        // S'assurer que les dates sont correctement formatées
                        start: start.toISOString(),
                        type: event.extendedProps?.type || 'general'
                    }
                };
            });
            
            // Cacher l'indicateur de chargement
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            // Retourner les événements formatés
            successCallback(formattedEvents);
            
            // Planifier les notifications pour les événements à venir
            this.scheduleEventNotifications(formattedEvents);
            
            // Masquer l'indicateur de chargement
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
        } catch (error) {
            console.error('Erreur lors du chargement des événements:', error);
            
            // Afficher un message d'erreur
            this.showNotification(error.message || 'Erreur lors du chargement des événements', 'danger');
            
            // Appeler le callback d'erreur avec un tableau vide pour éviter les erreurs
            successCallback([]);
            
            // Masquer l'indicateur de chargement
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }
    
    // Obtenir la couleur de l'événement en fonction du type
    getEventColor(type) {
        const colors = {
            'reunion': '#e83e8c',  // Rose
            'mariage': '#20c997',  // Turquoise
            'naissance': '#6c757d', // Gris
            'deces': '#343a40',    // Noir
            'general': '#3498db'   // Bleu
        };
        return colors[type] || '#3498db';
    }
    
    // Obtenir la couleur de la bordure de l'événement
    getEventBorderColor(type) {
        const colors = {
            'reunion': '#d63384',
            'mariage': '#198754',
            'naissance': '#495057',
            'deces': '#212529',
            'general': '#0d6efd'
        };
        return colors[type] || '#0d6efd';
    }

    // Gestion du clic sur une date
    handleDateClick(arg) {
        this.openEventModal({
            start: arg.date,
            end: new Date(arg.date.getTime() + 60 * 60 * 1000) // +1 heure par défaut
        });
    }

    // Gestion du clic sur un événement
    handleEventClick(clickInfo) {
        const event = clickInfo.event;
        const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
        
        // Mise à jour du contenu de la modale
        const modalTitle = document.getElementById('eventDetailsTitle');
        const modalBody = document.getElementById('eventDetailsBody');
        const deleteBtn = document.getElementById('deleteEventBtn');
        const editBtn = document.getElementById('editEventBtn');
        
        if (modalTitle) modalTitle.textContent = event.title;
        
        if (modalBody) {
            const start = event.start ? event.start.toLocaleString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Non défini';
            
            const end = event.end ? event.end.toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Non défini';
            
            modalBody.innerHTML = `
                <p><strong>Date de début :</strong> ${start}</p>
                <p><strong>Date de fin :</strong> ${end}</p>
                ${event.extendedProps.description ? 
                    `<p><strong>Description :</strong> ${event.extendedProps.description}</p>` : ''}
                ${event.extendedProps.location ? 
                    `<p><strong>Lieu :</strong> ${event.extendedProps.location}</p>` : ''}
                <p><strong>Type :</strong> ${this.getEventTypeBadge(event.extendedProps.type)}</p>
            `;
        }
        
        // Configuration des boutons
        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteEvent(event.id);
        }
        
        if (editBtn) {
            editBtn.onclick = () => {
                modal.hide();
                this.openEventModal({
                    id: event.id,
                    title: event.title,
                    start: event.start,
                    end: event.end,
                    description: event.extendedProps.description || '',
                    location: event.extendedProps.location || '',
                    type: event.extendedProps.type || 'general'
                });
            };
        }
        
        modal.show();
    }

    // Ouverture du formulaire d'événement
    openEventModal(eventData = {}) {
        const modal = new bootstrap.Modal(document.getElementById('eventModal'));
        const form = document.getElementById('eventForm');
        
        if (!form) return;
        
        // Réinitialisation du formulaire
        form.reset();
        
        // Remplissage des champs si édition
        if (eventData.id) {
            document.getElementById('eventId').value = eventData.id;
            document.getElementById('eventTitle').value = eventData.title || '';
            document.getElementById('eventDescription').value = eventData.description || '';
            document.getElementById('eventLocation').value = eventData.location || '';
            document.getElementById('eventType').value = eventData.type || 'general';
            
            // Formatage des dates pour les champs datetime-local
            const formatDate = (date) => {
                if (!date) return '';
                const d = new Date(date);
                return d.toISOString().slice(0, 16);
            };
            
            document.getElementById('eventStart').value = formatDate(eventData.start);
            document.getElementById('eventEnd').value = formatDate(eventData.end);
            
            // Changement du titre du formulaire
            document.getElementById('eventModalLabel').textContent = 'Modifier l\'événement';
        } else {
            document.getElementById('eventModalLabel').textContent = 'Nouvel événement';
            
            // Valeurs par défaut pour un nouvel événement
            const now = new Date();
            const defaultStart = new Date(now);
            defaultStart.setHours(now.getHours() + 1, 0, 0, 0); // Prochaine heure pile
            
            const defaultEnd = new Date(defaultStart);
            defaultEnd.setHours(defaultStart.getHours() + 1); // 1 heure de durée par défaut
            
            document.getElementById('eventStart').value = defaultStart.toISOString().slice(0, 16);
            document.getElementById('eventEnd').value = defaultEnd.toISOString().slice(0, 16);
        }
        
        // Gestion de la soumission du formulaire
        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveEvent();
            modal.hide();
        };
        
        modal.show();
    }

    // Sauvegarde d'un événement
    async saveEvent() {
        const form = document.getElementById('eventForm');
        if (!form) return;
        
        const eventData = {
            id: document.getElementById('eventId').value || undefined,
            title: document.getElementById('eventTitle').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            location: document.getElementById('eventLocation').value.trim(),
            type: document.getElementById('eventType').value,
            start: document.getElementById('eventStart').value,
            end: document.getElementById('eventEnd').value
        };
        
        // Validation
        if (!eventData.title) {
            this.showNotification('Le titre est obligatoire', 'warning');
            return;
        }
        
        if (!eventData.start) {
            this.showNotification('La date de début est obligatoire', 'warning');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Non authentifié');
            
            const method = eventData.id ? 'PUT' : 'POST';
            const url = eventData.id 
                ? `/api/calendrier/${eventData.id}` 
                : '/api/calendrier';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(eventData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de la sauvegarde');
            }
            
            const result = await response.json();
            this.calendar.refetchEvents();
            this.showNotification('Événement enregistré avec succès', 'success');
            return result;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            this.showNotification(`Erreur: ${error.message}`, 'danger');
            throw error;
        }
    }

    // Suppression d'un événement
    async deleteEvent(eventId) {
        if (!eventId || !confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Non authentifié');
            
            const response = await fetch(`/api/calendrier/${eventId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de la suppression');
            }
            
            this.calendar.refetchEvents();
            this.showNotification('Événement supprimé avec succès', 'success');
            
            // Fermer la modale de détails si elle est ouverte
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal'));
            if (detailsModal) detailsModal.hide();
            
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            this.showNotification(`Erreur: ${error.message}`, 'danger');
        }
    }

    // Gestion du glisser-déposer
    async handleEventDrop(dropInfo) {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Non authentifié');
            
            const event = dropInfo.event;
            const eventData = {
                id: event.id,
                title: event.title,
                description: event.extendedProps.description || '',
                location: event.extendedProps.location || '',
                type: event.extendedProps.type || 'autre', // Valeurs acceptées: 'naissance', 'mariage', 'deces', 'autre'
                start: event.start ? event.start.toISOString() : null,
                end: event.end ? event.end.toISOString() : null
            };
            
            await fetch(`/api/calendrier/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(eventData)
            });
            
            this.showNotification('Événement mis à jour', 'success');
        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            this.showNotification('Erreur lors de la mise à jour de l\'événement', 'danger');
            this.calendar.refetchEvents(); // Recharger les événements pour annuler le glisser-déposer
        }
    }

    // Gestion du redimensionnement
    handleEventResize(resizeInfo) {
        this.handleEventDrop(resizeInfo);
    }

    // Personnalisation du rendu des événements
    handleEventDidMount(info) {
        // Ajout d'une classe CSS basée sur le type d'événement
        if (info.event.extendedProps.type) {
            info.el.classList.add(`event-type-${info.event.extendedProps.type}`);
        }
        
        // Ajout d'un effet de survol
        info.el.addEventListener('mouseenter', () => {
            info.el.style.transform = 'scale(1.02)';
            info.el.style.transition = 'transform 0.2s';
        });
        
        info.el.addEventListener('mouseleave', () => {
            info.el.style.transform = '';
        });
    }

    // Rendu personnalisé du contenu des événements
    renderEventContent(info) {
        const event = info.event;
        const timeText = info.timeText ? `<div class="fc-event-time">${info.timeText}</div>` : '';
        const title = `<div class="fc-event-title">${event.title}</div>`;
        
        // Ajout d'un indicateur visuel pour les événements de type différent
        const eventType = event.extendedProps?.type || 'general';
        const typeBadge = eventType !== 'general' 
            ? `<span class="badge bg-secondary me-1">${eventType}</span>` 
            : '';
        
        return { 
            html: `${timeText}${typeBadge}${title}`
        };
    }

    // Configuration de la barre de recherche
    setupSearch() {
        // Création des éléments
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Rechercher un événement...';
        searchInput.className = 'search-input';
        
        // Conteneur de recherche avec icône
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container d-flex align-items-center';
        searchContainer.innerHTML = '<i class="fas fa-search"></i>';
        searchContainer.appendChild(searchInput);
        
        // Ajout au header du calendrier
        const header = document.querySelector('.fc-header-toolbar');
        if (header) {
            // Créer un conteneur pour le titre et la recherche
            const titleContainer = document.createElement('div');
            titleContainer.className = 'd-flex align-items-center';
            
            // Déplacer le titre dans le nouveau conteneur
            const title = header.querySelector('.fc-toolbar-title');
            if (title) {
                titleContainer.appendChild(title);
                header.insertBefore(titleContainer, header.firstChild);
                
                // Ajouter la barre de recherche à côté du titre
                titleContainer.appendChild(searchContainer);
            }
            
            // Gestion de la recherche en temps réel
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = e.target.value.trim().toLowerCase();
                    const events = this.calendar.getEvents();
                    
                    if (searchTerm === '') {
                        // Si la recherche est vide, afficher tous les événements
                        events.forEach(event => {
                            event.setProp('display', 'auto');
                        });
                    } else {
                        // Sinon, filtrer les événements
                        events.forEach(event => {
                            const eventText = `${event.title || ''} ${event.extendedProps.description || ''} ${event.extendedProps.location || ''}`.toLowerCase();
                            const isVisible = eventText.includes(searchTerm);
                            event.setProp('display', isVisible ? 'auto' : 'none');
                        });
                    }
                }, 300); // Délai de 300ms avant la recherche
            });
        }
    }

    // Configuration des notifications
    setupNotifications() {
        // Vérifier les notifications autorisées
        if (!('Notification' in window)) {            return;
        }
        
        // Vérifier si les notifications sont déjà autorisées
        if (Notification.permission === 'granted') {
            return;
        }
        
        // Demander la permission si nécessaire
        if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notifications autorisées');
                }
            });
        }
    }

    // Planification des notifications pour les événements à venir
    scheduleEventNotifications(events) {
        // Vérifier si les notifications sont supportées et autorisées
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        const now = new Date();
        
        // Parcourir tous les événements
        events.forEach(event => {
            try {
                if (!event.start) return;
                
                // S'assurer que start est un objet Date
                const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
                
                // Vérifier si la date est valide
                if (isNaN(eventStart.getTime())) {
                    console.error('Date de début invalide pour l\'événement:', event);
                    return;
                }
                
                const timeUntilEvent = eventStart - now;
                
                // Ne pas notifier les événements passés (plus de 5 minutes en retard)
                if (timeUntilEvent < -300000) return;
                
                // Si l'événement est dans moins de 5 minutes, notifier immédiatement
                if (timeUntilEvent > 0 && timeUntilEvent <= 300000) {
                    this.showDesktopNotification(
                        `Événement à venir: ${event.title || 'Sans titre'}`,
                        `Commence dans ${Math.ceil(timeUntilEvent / 60000)} minutes`
                    );
                }
                // Sinon, planifier une notification 30 minutes avant
                else if (timeUntilEvent > 300000) {
                    const notificationTime = timeUntilEvent - (29 * 60 * 1000); // 1 minute après le chargement
                    
                    if (notificationTime > 0) {
                        setTimeout(() => {
                            this.showDesktopNotification(
                                `Événement à venir: ${event.title || 'Sans titre'}`,
                                `Commence dans 30 minutes`
                            );
                        }, notificationTime);
                    }
                }
                
                // Planifier également une notification au moment de l'événement
                if (timeUntilEvent > 0) {
                    setTimeout(() => {
                        this.showDesktopNotification(
                            `Événement en cours: ${event.title || 'Sans titre'}`,
                            `L'événement commence maintenant`
                        );
                    }, timeUntilEvent);
                }
                
            } catch (error) {
                console.error('Erreur lors de la planification de la notification:', error);
            }
        });
    }

    // Affichage d'une notification de bureau
    showDesktopNotification(title, body) {
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, { body });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Fermer la notification après 10 secondes
            setTimeout(notification.close.bind(notification), 10000);
        }
    }

    // Affichage d'une notification dans l'interface
    showNotification(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.top = '20px';
        alert.style.right = '20px';
        alert.style.zIndex = '9999';
        alert.style.minWidth = '300px';
        alert.role = 'alert';
        
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
        `;
        
        document.body.appendChild(alert);
        
        // Supprimer la notification après 5 secondes
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => { if (alert && alert.parentNode) alert.remove(); }, 150);
        }, 5000);
    }

    // Configuration des écouteurs d'événements
    setupEventListeners() {
        // Rafraîchissement automatique toutes les 5 minutes
        setInterval(() => {
            this.calendar.refetchEvents();
        }, 300000); // 5 minutes en millisecondes
        
        // Rafraîchissement lors du retour en ligne
        window.addEventListener('online', () => {
            this.calendar.refetchEvents();
            this.showNotification('Connexion rétablie', 'success');
        });
        
        // Gestion de la déconnexion
        window.addEventListener('offline', () => {
            this.showNotification('Vous êtes hors ligne. Les modifications seront synchronisées dès la reconnexion.', 'warning');
        });
    }

    // Méthodes utilitaires
    getEventTypeBadge(type) {
        const types = {
            'reunion': { text: 'Réunion', class: 'bg-primary' },
            'mariage': { text: 'Mariage', class: 'bg-success' },
            'naissance': { text: 'Naissance', class: 'bg-info' },
            'deces': { text: 'Décès', class: 'bg-dark' },
            'general': { text: 'Général', class: 'bg-secondary' }
        };
        
        const eventType = types[type] || { text: type, class: 'bg-secondary' };
        return `<span class="badge ${eventType.class}">${eventType.text}</span>`;
    }
}

// Initialisation du calendrier au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Ajouter un indicateur de chargement
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.style.display = 'none';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.zIndex = '9999';
    loadingIndicator.style.padding = '15px 30px';
    loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.innerHTML = '<div class="spinner-border text-light me-2" role="status"><span class="visually-hidden">Chargement...</span></div> Chargement des événements...';
    document.body.appendChild(loadingIndicator);
    
    // Initialiser le gestionnaire de calendrier
    try {
        window.calendrierManager = new CalendrierManager();
        
        // Gestion du bouton d'ajout d'événement
        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.calendrierManager) {
                    window.calendrierManager.openEventModal();
                }
            });
        }
        
        // Masquer l'indicateur de chargement après un court délai
        setTimeout(() => {
            loadingIndicator.style.display = 'none';
        }, 1000);
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du calendrier:', error);
        loadingIndicator.innerHTML = 'Erreur lors du chargement du calendrier. Veuillez rafraîchir la page.';
        loadingIndicator.style.backgroundColor = '#dc3545';
        
        // Masquer l'indicateur de chargement après 5 secondes
        setTimeout(() => {
            loadingIndicator.style.display = 'none';
        }, 5000);
    }
});

// Gestion du redimensionnement de la fenêtre
window.addEventListener('resize', () => {
    if (window.calendrierManager && window.calendrierManager.calendar) {
        window.calendrierManager.calendar.updateSize();
    }
});







