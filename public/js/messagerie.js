class MessageSystem {
  constructor() {
    this.socket = null;
    this.currentConversation = null;
    this.currentUser = JSON.parse(localStorage.getItem('user'));
    this.conversations = [];
    this.users = [];
    this.typingTimeout = null;

    this.init();
  }

  async init() {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!this.currentUser || !this.currentUser.id) {
        console.error('Utilisateur non connecté');
        return;
      }

      // Initialize Socket.IO connection
      this.socket = io();
      this.setupSocketEvents();

      try {
        // Essayer de charger les utilisateurs (peut échouer pour les non-admins)
        await this.loadUsers();
      } catch (error) {
        console.warn('Impossible de charger la liste des utilisateurs, poursuite du chargement...', error);
      }

      // Charger les conversations
      try {
        await this.loadConversations();
      } catch (error) {
        console.error('Erreur lors du chargement des conversations:', error);
        this.showAlert('Impossible de charger les conversations. Veuillez réessayer plus tard.', 'error');
      }

      // Configurer les écouteurs d'événements
      this.setupEventListeners();

    } catch (error) {
      console.error('Erreur lors de l\'initialisation du système de messagerie:', error);
      this.showAlert('Une erreur est survenue lors du chargement de la messagerie.', 'error');
    }
  }

  async setupSocketEvents() {
    if (!this.socket) {
      console.error('Socket.IO n\'est pas initialisé');
      return;
    }

    try {
      console.log('=== INITIALISATION SOCKET.IO ===');
      console.log('ID utilisateur actuel:', this.currentUser.id);

      // Rejoindre la salle de l'utilisateur
      this.socket.emit('join', this.currentUser.id);
      console.log('Événement \'join\' émis avec l\'ID:', this.currentUser.id);

      // Vérifier l'état de la connexion
      console.log('État de la connexion Socket.IO:', this.socket.connected ? 'Connecté' : 'Déconnecté');
      console.log('ID de la socket:', this.socket.id);

      // Écouter les événements de connexion
      this.socket.on('connect', () => {
        console.log('Connecté au serveur Socket.IO avec l\'ID:', this.socket.id);
        console.log('Envoi de l\'événement \'join\' avec l\'ID utilisateur:', this.currentUser.id);
        this.socket.emit('join', this.currentUser.id);
      });

      // Écouter les nouveaux messages
      this.socket.on('newMessage', (message) => {
        console.log('=== NOUVEAU MESSAGE RECU VIA SOCKET.IO ===');
        console.log('Message brut reçu:', message);

        // Vérifier si le message est valide
        if (!message) {
          console.error('Message vide reçu');
          return;
        }

        console.log('Détails du message reçu:');
        console.log('- ID:', message._id);
        console.log('- Contenu:', message.content);
        console.log('- Conversation ID:', message.conversationId || (message.conversation && message.conversation._id));
        console.log('- Expéditeur:', message.sender ?
          `${message.sender.name || 'Inconnu'} (${message.sender._id || message.sender})` : 'Inconnu');

        // Vérifier si le message est pour la conversation actuelle
        const isForCurrentConversation = this.currentConversation &&
          ((message.conversationId === this.currentConversation._id) ||
            (message.conversation && message.conversation._id === this.currentConversation._id));

        // Mettre à jour l'interface utilisateur
        if (isForCurrentConversation) {
          this.addMessageToChat(message);
          this.scrollToBottom();
        }

        // Mettre à jour la liste des conversations
        this.updateConversationList(message);

        // Jouer un son de notification si le message n'est pas de l'utilisateur actuel
        if (message.sender && message.sender._id !== this.currentUser.id) {
          this.playNotificationSound();

          // Afficher une notification si la fenêtre n'est pas active
          if (document.hidden) {
            this.showDesktopNotification('Nouveau message', `De: ${message.sender.name || 'Expéditeur inconnu'}`);
          }
        }
      });

      // Écouter les notifications de nouveaux messages
      this.socket.on('newMessageNotification', (data) => {
        console.log('=== NOTIFICATION DE NOUVEAU MESSAGE ===', data);

        // Mettre à jour le compteur de messages non lus
        if (data.conversationId) {
          this.updateUnreadCount(data.conversationId, data.unreadCount || 1);
        }

        // Jouer un son de notification
        this.playNotificationSound();

        // Afficher une notification si la fenêtre n'est pas active
        if (document.hidden && data.message && data.message.sender) {
          this.showDesktopNotification(
            'Nouveau message',
            `De: ${data.message.sender.name || 'Expéditeur inconnu'}`
          );
        }
      });

      // Écouter les erreurs
      this.socket.on('error', (error) => {
        console.error('Erreur Socket.IO:', error);
        this.showAlert(error.message || 'Une erreur est survenue', 'error');
      });

      // Écouter les indicateurs de frappe
      this.socket.on('userTyping', (data) => {
        console.log('Utilisateur en train d\'écrire:', data);
        this.showTypingIndicator(data);
      });

      this.socket.on('userStoppedTyping', (data) => {
        console.log('Utilisateur a arrêté d\'écrire');
        this.hideTypingIndicator(data);
      });

      // Écouter les mises à jour de statut des utilisateurs
      this.socket.on('userOnline', (userId) => {
        console.log('Utilisateur en ligne:', userId);
        this.updateUserStatus(userId, true);
      });

      this.socket.on('userOffline', (userId) => {
        console.log('Utilisateur hors ligne:', userId);
        this.updateUserStatus(userId, false);
      });

      // Rejoindre automatiquement les conversations actives
      if (this.currentConversation) {
        await this.joinConversation(this.currentConversation._id);
      }

      // Gestion des erreurs de connexion
      this.socket.on('connect_error', (error) => {
        console.error('Erreur de connexion Socket.IO:', error);
        this.showAlert('Problème de connexion. Tentative de reconnexion...', 'warning');

        // Tentative de reconnexion
        setTimeout(() => {
          if (this.socket) {
            this.socket.connect();
          }
        }, 5000);
      });

      // Reconnexion réussie
      this.socket.on('reconnect', async () => {
        console.log('Reconnecté à Socket.IO');
        // Rejoindre à nouveau la salle de l'utilisateur
        this.socket.emit('join', this.currentUser.id);

        // Rejoindre la conversation actuelle si elle existe
        if (this.currentConversation) {
          await this.joinConversation(this.currentConversation._id);
        }
      });

      // Gestion de la déconnexion
      this.socket.on('disconnect', (reason) => {
        console.log('Déconnecté de Socket.IO. Raison:', reason);
        if (reason === 'io server disconnect') {
          // Reconnexion automatique
          this.socket.connect();
        }
      });
    } catch (error) {
      console.error('Error setting up socket events:', error);
      this.socket = null;
    }
  }

  setupEventListeners() {
    // Message form submission
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
      messageForm.addEventListener('submit', (e) => this.sendMessage(e));
    }

    // New message form submission
    const newMessageForm = document.getElementById('newMessageForm');
    if (newMessageForm) {
      newMessageForm.addEventListener('submit', (e) => this.createNewConversation(e));
    }

    // Accessibility: prevent focused element from remaining inside an aria-hidden modal
    const newMessageModal = document.getElementById('newMessageModal');
    if (newMessageModal) {
      newMessageModal.addEventListener('hide.bs.modal', () => {
        if (document.activeElement && newMessageModal.contains(document.activeElement)) {
          document.activeElement.blur();
          // Move focus to a safe, visible element outside the modal
          const defaultFocusTarget = document.querySelector('[data-focus-default]') || document.body;
          if (defaultFocusTarget && typeof defaultFocusTarget.focus === 'function') {
            defaultFocusTarget.focus({ preventScroll: true });
          }
        }
      });
      newMessageModal.addEventListener('shown.bs.modal', () => {
        const firstFocusable = newMessageModal.querySelector('input, select, textarea, button');
        if (firstFocusable) {
          firstFocusable.focus({ preventScroll: true });
        }
      });
    }

    // Search conversations
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.searchConversations(e.target.value));
    }

    // Typing indicator for message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('input', () => this.handleTyping());
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          messageForm.dispatchEvent(new Event('submit'));
        }
      });
    }
  }

  async loadConversations() {
    try {
      const response = await apiRequest('/api/conversations', 'GET');
      if (response && response.success) {
        this.conversations = response.data;
        this.displayConversations(this.conversations);
      } else {
        console.error('Invalid response format:', response);
        this.showAlert('Format de réponse invalide du serveur', 'danger');
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.showAlert('Erreur lors du chargement des conversations. Vérifiez votre connexion.', 'danger');

      // Fallback: afficher un message d'erreur dans l'interface
      const conversationsContainer = document.getElementById('conversations');
      if (conversationsContainer) {
        conversationsContainer.innerHTML = `
          <div class="text-center text-danger py-4">
            <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
            <p>Impossible de charger les conversations</p>
            <button class="btn btn-outline-primary btn-sm" onclick="messageSystem.loadConversations()">
              <i class="fas fa-redo me-2"></i>Réessayer
            </button>
          </div>
        `;;;
      }
    }
  }

  async loadUsers() {
    try {
      // Vérifier si l'utilisateur est administrateur avant de faire l'appel API
      const isAdmin = this.currentUser && this.currentUser.role === 'admin';

      if (!isAdmin) {
        console.log('Chargement des utilisateurs : accès non administrateur détecté, chargement minimal');
        this.users = [];
        this.populateUserSelect();
        return;
      }

      // Seuls les administrateurs arrivent ici
      console.log('Chargement de la liste complète des utilisateurs (admin)');
      const response = await apiRequest('/api/users', 'GET');

      if (response && response.success) {
        // Filtrer l'utilisateur actuel de la liste
        this.users = response.data.filter(user => user._id !== this.currentUser.id);
        this.populateUserSelect();
      } else {
        console.warn('Impossible de charger la liste des utilisateurs:', response?.message || 'Erreur inconnue');
        this.users = [];
        this.populateUserSelect();
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      this.users = [];
      this.populateUserSelect();
    }
  }

  displayConversations(conversations) {
    const conversationsContainer = document.getElementById('conversations');
    if (!conversationsContainer) return;

    if (conversations.length === 0) {
      conversationsContainer.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="fas fa-comments fa-2x mb-3"></i>
          <p>Aucune conversation</p>
          <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#newMessageModal">
            Commencer une conversation
          </button>
        </div>
      `;
      return;
    }

    conversationsContainer.innerHTML = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id !== this.currentUser.id);
      const lastMessage = conv.lastMessage;
      const isUnread = conv.unreadCount > 0;

      return `
        <div class="conversation-item ${conv._id === this.currentConversation?._id ? 'active' : ''}" 
             onclick="messageSystem.selectConversation('${conv._id}')">
          <div class="d-flex align-items-center">
            <div class="user-avatar">
              ${otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div class="conversation-info">
              <div class="d-flex justify-content-between align-items-center">
                <div class="conversation-name">
                  ${otherParticipant?.name || 'Utilisateur inconnu'}
                  ${this.isUserOnline(otherParticipant?._id) ? '<span class="online-indicator"></span>' : ''}
                </div>
                <div class="conversation-time">
                  ${lastMessage ? this.formatTime(lastMessage.createdAt) : ''}
                </div>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <div class="conversation-preview">
                  ${lastMessage ? lastMessage.content : 'Nouvelle conversation'}
                </div>
                ${isUnread ? `<span class="unread-count">${conv.unreadCount}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async selectConversation(conversationId, event = null) {
    try {
      console.log('=== SÉLECTION DE CONVERSATION ===');
      console.log('ID de conversation:', conversationId);

      // Trouver la conversation dans la liste
      const conversation = this.conversations.find(c => c._id === conversationId);
      if (!conversation) {
        console.error('ERREUR: Conversation', conversationId, 'introuvable');
        return;
      }

      console.log('Conversation trouvée:', conversation);

      // Mettre à jour la conversation courante
      this.currentConversation = conversation;

      // Mettre à jour l'interface utilisateur
      document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.conversationId === conversationId) {
          item.classList.add('active');
        }
      });

      // Afficher la zone de saisie
      const messageInputContainer = document.getElementById('messageInputContainer');
      if (messageInputContainer) {
        messageInputContainer.style.display = 'block';
        console.log('Zone de saisie affichée');
      } else {
        console.error('ERREUR: Impossible de trouver la zone de saisie');
      }

      // Donner le focus au champ de saisie
      const messageInput = document.getElementById('messageInput');
      if (messageInput) {
        setTimeout(() => {
          messageInput.focus();
        }, 100);
      }

      // Mettre à jour l'en-tête de la conversation
      this.updateConversationHeader(conversation);

      // Charger les messages de la conversation
      await this.loadMessages(conversationId);

      // Rejoindre la salle de conversation
      console.log('Rejoindre la salle de conversation:', conversationId);
      await this.joinConversation(conversationId);

      // Marquer la conversation comme lue
      console.log(`Marquage de la conversation comme lue: ${conversationId}`);
      await this.markConversationAsRead(conversationId);

      console.log('Conversation sélectionnée avec succès');
    } catch (error) {
      console.error('Erreur lors de la sélection de la conversation:', error);
    }
  }
}

  async loadMessages(conversationId) {
  if (!conversationId) {
    console.error('ID de conversation manquant');
    return [];
  }

  try {
    const response = await apiRequest(`/api/conversations/${conversationId}/messages`, 'GET');
    if (response && response.success) {
      const messages = response.messages || [];
      if (messages.length > 0) {
        this.displayMessages(messages);
      }
      return messages;
    }
    return [];
  } catch (error) {
    console.error('Erreur lors du chargement des messages:', error);
    this.showAlert('Impossible de charger les messages', 'error');
    return [];
  }
}

displayMessages(messages) {
  try {
    console.log('=== AFFICHAGE DES MESSAGES ===');
    console.log('Messages à afficher:', messages);

    const messagesList = document.getElementById('messagesList');
    if (!messagesList) {
      console.error('ERREUR: Conteneur de messages (messagesList) introuvable dans le DOM');
      console.log('Éléments avec ID messagesList:', document.querySelectorAll('#messagesList'));
      return;
    }

    // Vider la liste des messages
    messagesList.innerHTML = '';

    if (!messages || messages.length === 0) {
      messagesList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-comment"></i>
            <p>Aucun message dans cette conversation</p>
          </div>
        `;;;
      return;
    }

    // Trier les messages par date (du plus ancien au plus récent)
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    // Afficher chaque message
    sortedMessages.forEach(message => {
      this.addMessageToChat(message);
    });

    // Faire défiler vers le bas
    this.scrollToBottom();

    console.log('Messages affichés avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'affichage des messages:', error);
  }
}

updateConversationHeader(conversation) {
  try {
    const header = document.getElementById('conversationHeader');
    if (!header) {
      console.error('En-tête de conversation introuvable');
      return;
    }

    let otherParticipant;
    if (conversation && conversation.participants && conversation.participants.length > 0) {
      otherParticipant = conversation.participants.find(p =>
        p._id !== this.currentUser.id &&
        p._id.toString() !== this.currentUser.id.toString()
      );
    }

    // Vérifier si un participant a été trouvé
    if (!otherParticipant && conversation && conversation.participants && conversation.participants.length > 0) {
      // Prendre le premier participant si l'utilisateur actuel n'est pas trouvé
      otherParticipant = conversation.participants[0];
    }

    // Créer le contenu HTML de l'en-tête
    const headerContent = `
        <div class="d-flex align-items-center">
          <div class="user-avatar me-3">
            ${otherParticipant && otherParticipant.name ? otherParticipant.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h5 class="mb-0">${otherParticipant && otherParticipant.name ? otherParticipant.name : 'Utilisateur inconnu'}</h5>
            <small class="text-muted">
              ${this.isUserOnline(otherParticipant && otherParticipant._id ? otherParticipant._id : '') ? 'En ligne' : 'Hors ligne'}
            </small>
          </div>
        </div>
      `;;

    header.innerHTML = headerContent;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'en-tête de la conversation:', error);
  }
}

  async sendMessage() {
  if (!this.currentConversation) {
    console.error('Aucune conversation sélectionnée pour l\'envoi du message');
    this.showAlert('Aucune conversation sélectionnée', 'warning');
    return;
  }

  const messageInput = document.getElementById('messageInput');
  if (!messageInput) {
    console.error('Champ de saisie de message introuvable');
    return;
  }

  const content = messageInput.value.trim();

  if (!content) {
    console.log('Tentative d\'envoi d\'un message vide, ignoré');
    return;
  }

  try {
    // Créer un message temporaire pour l'affichage immédiat
    const tempMessage = {
      _id: 'temp-' + Date.now(),
      content: content,
      sender: {
        _id: this.currentUser.id,
        name: this.currentUser.name || 'Utilisateur'
      },
      conversation: this.currentConversation._id,
      conversationId: this.currentConversation._id,
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    // Afficher le message immédiatement
    this.addMessageToChat(tempMessage);
    this.scrollToBottom();

    // Réinitialiser le champ de saisie
    messageInput.value = '';

    // Vérifier si le socket est disponible
    if (this.socket) {
      // Envoyer le message via Socket.IO
      this.socket.emit('sendMessage', {
        conversationId: this.currentConversation._id,
        content: content,
        senderId: this.currentUser.id,
        recipientId: this.getOtherParticipantId()
      });
    } else {
      console.warn('Socket.IO non initialisé, envoi du message via HTTP uniquement');
    }

    // Envoyer également via HTTP pour assurer la persistance
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }

      const response = await fetch('/api/conversations/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: this.currentConversation._id,
          content: content
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();;

      if (data.success && data.data) {
        // Mettre à jour le message avec la réponse du serveur
        this.updateMessageStatus(tempMessage._id, {
          _id: data.data._id,
          status: 'sent',
          ...data.data
        });

        // Mettre à jour la liste des conversations si la méthode existe
        if (typeof this.updateConversationList === 'function') {
          this.updateConversationList({
            ...data.data,
            conversation: this.currentConversation
          });
        }
      } else {
        // Marquer le message comme erreur
        this.updateMessageStatus(tempMessage._id, {
          status: 'error',
          error: data.error || 'Erreur lors de l\'envoi du message'
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      this.updateMessageStatus(tempMessage._id, {
        status: 'error',
        error: 'Erreur de connexion au serveur: ' + error.message
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    this.showAlert('Une erreur est survenue lors de l\'envoi du message: ' + error.message, 'error');
  }
}

createMessageElement(message) {
  try {
    if (!message) {
      console.error('Message non défini dans createMessageElement');
      return document.createElement('div');
    }

    // Créer l'élément de message
    const messageElement = document.createElement('div');

    // Vérifier si le message est de l'utilisateur actuel
    const isCurrentUser = message.sender && this.currentUser &&
      (message.sender._id === this.currentUser.id ||
        (typeof message.sender === 'string' && message.sender === this.currentUser.id));

    // Définir les classes CSS en fonction de l'expéditeur
    messageElement.className = `message ${isCurrentUser ? 'message-sent' : 'message-received'}`;

    // Définir l'ID du message pour les mises à jour ultérieures
    if (message._id) {
      messageElement.dataset.messageId = message._id;
    }

    // Formater l'heure du message
    let messageTime = 'Maintenant';
    try {
      if (message.createdAt) {
        const date = new Date(message.createdAt);
        if (!isNaN(date.getTime())) {
          messageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch (e) {
      console.error('Erreur de formatage de la date:', e);
    }

    // Déterminer le nom de l'expéditeur
    let senderName = 'Expéditeur inconnu';
    if (message.sender) {
      if (typeof message.sender === 'string') {
        senderName = message.sender;
      } else if (message.sender.name) {
        senderName = message.sender.name;
      } else if (message.senderId) {
        // Essayer de trouver le nom dans la liste des utilisateurs
        const user = this.users.find(u => u._id === message.senderId);
        senderName = user ? user.name : `Utilisateur ${message.senderId.substring(0, 6)}`;
      }
    }

    // Créer le contenu du message en toute sécurité
    const messageHTML = `
        <div class="message-content">
          ${!isCurrentUser ?
        `;<div class="message-sender">${this.escapeHtml(senderName)}</div>` : ''}
          <div class="message-text">${this.escapeHtml(message.content || '')}</div>
          <div class="message-time">
            ${messageTime}
            ${isCurrentUser ?
        `;<span class="message-status ${message.status || 'sending'}">
                ${message.status === 'sent' ? '✓✓' : message.status === 'error' ? '!' : '↻'}
              </span>` : ''}
          </div>
        </div>
      `;;

    messageElement.innerHTML = messageHTML;

    // Ajouter un titre pour les erreurs
    if (message.status === 'error') {
      messageElement.title = message.error || 'Erreur lors de l\'envoi';
    }

    return messageElement;
  } catch (error) {
    console.error('Erreur dans createMessageElement:', error);
    const errorElement = document.createElement('div');
    errorElement.className = 'message-error';
    errorElement.textContent = 'Erreur lors de l\'affichage du message';
    return errorElement;
  }
}

addMessageToChat(message) {
  try {
    console.log('=== ADD MESSAGE TO CHAT ===');
    console.log('Message reçu:', message);

    if (!message) {
      console.error('Erreur: Message non défini');
      return;
    }

    // Vérifier si l'utilisateur est défini
    if (!this.currentUser || !this.currentUser.id) {
      console.error('Erreur: Utilisateur non connecté');
      return;
    }

    // Utiliser le bon conteneur de messages (messagesList)
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) {
      console.error('ERREUR: Conteneur de messages (messagesList) introuvable');
      return;
    }

    // Vérifier si l'expéditeur est l'utilisateur actuel
    const isOwn = message.sender &&
      (message.sender._id === this.currentUser.id ||
        message.sender === this.currentUser.id ||
        (typeof message.sender === 'object' && message.sender.id === this.currentUser.id));

    // Créer l'élément de message
    const messageElement = document.createElement('div');
    messageElement.className = `message-item ${isOwn ? 'own' : ''}`;

    // Définir l'ID du message pour les mises à jour ultérieures
    if (message._id) {
      messageElement.dataset.messageId = message._id;
    } else if (message.id) {
      messageElement.dataset.messageId = message.id;
    } else {
      // Générer un ID temporaire si aucun n'est fourni
      const tempId = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      messageElement.dataset.messageId = tempId;
    }

    // Formater l'heure du message
    let messageTime = 'Maintenant';
    try {
      if (message.createdAt) {
        const date = new Date(message.createdAt);
        if (!isNaN(date.getTime())) {
          messageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch (e) {
      console.error('Erreur de formatage de la date:', e);
    }

    // Déterminer le nom de l'expéditeur
    let senderName = 'Utilisateur inconnu';
    if (message.sender) {
      if (typeof message.sender === 'string') {
        senderName = message.sender;
      } else if (message.sender.name) {
        senderName = message.sender.name;
      } else if (message.senderId) {
        // Essayer de trouver le nom dans la liste des utilisateurs
        const user = this.users.find(u => u._id === message.senderId);
        senderName = user ? user.name : `Utilisateur ${message.senderId.substring(0, 6)}`;
      }
    }

    // Créer le contenu du message en toute sécurité
    const messageHTML = `
        ${!isOwn ?
        `;<div class="user-avatar">${senderName ? senderName.charAt(0).toUpperCase() : '?'}</div>` :
        ''}
        <div class="message-content">
          ${!isOwn ?
        `;<div class="message-sender">${this.escapeHtml(senderName)}</div>` :
        ''}
          <div class="message-text">${this.escapeHtml(message.content || '')}</div>
          <div class="message-time">
            ${messageTime}
            ${isOwn ?
        `;<span class="message-status ${message.status || 'sending'}">
                ${message.status === 'sent' ? '✓✓' : message.status === 'error' ? '!' : '↻'}
              </span>` :
        ''}
          </div>
        </div>
      `;;

    messageElement.innerHTML = messageHTML;

    // Ajouter un titre pour les erreurs
    if (message.status === 'error') {
      messageElement.title = message.error || 'Erreur lors de l\'envoi';
    }

    // Vérifier si le message existe déjà
    const existingMessage = messagesList.querySelector(`[data-message-id="${message._id}"]`);
    if (existingMessage) {
      // Mettre à jour le message existant
      existingMessage.replaceWith(messageElement);
    } else {
      // Ajouter le nouveau message
      messagesList.appendChild(messageElement);

      // Animation d'apparition
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.style.transition = 'opacity 0.3s ease';
        messageElement.style.opacity = '1';
      }, 10);
    }

    // Faire défiler vers le bas
    this.scrollToBottom();
  } catch (error) {
    console.error('Erreur dans addMessageToChat:', error);
  }
}

scrollToBottom() {
  const messagesList = document.getElementById('messagesList');
  if (messagesList) {
    messagesList.scrollTop = messagesList.scrollHeight;
  }
}

updateMessageStatus(messageId, updates) {
  try {
    if (!messageId) {
      console.warn('ID de message non fourni pour la mise à jour');
      return;
    }

    if (!updates || typeof updates !== 'object') {
      console.warn('Mises à jour non valides fournies pour le message:', messageId);
      return;
    }

    // Trouver l'élément du message
    const selector = `[data-message-id="${messageId}"]`;
    const messageElement = document.querySelector(selector);

    if (!messageElement) {
      console.warn('Message non trouvé pour mise à jour:', messageId);
      console.log('Sélecteur utilisé:', selector);
      return;
    }

    // Mettre à jour le contenu du message si fourni
    if (updates.content !== undefined) {
      const contentElement = messageElement.querySelector('.message-text');
      if (contentElement) {
        contentElement.textContent = updates.content;
      } else {
        console.warn('Élément de contenu du message non trouvé');
      }
    }

    // Mettre à jour le statut si fourni
    if (updates.status) {
      // Supprimer tous les états de statut existants
      const statusClasses = ['message-sending', 'message-sent', 'message-error'];
      messageElement.classList.remove(...statusClasses);

      // Ajouter la classe correspondant au nouveau statut
      const newStatusClass = `message-${updates.status}`;
      messageElement.classList.add(newStatusClass);

      // Mettre à jour le statut visuel
      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        let statusIcon = '↻'; // Par défaut : icône d'envoi en cours

        if (updates.status === 'sent') {
          statusIcon = '✓✓';
        } else if (updates.status === 'error') {
          statusIcon = '!';
        }

        statusElement.className = `message-status ${updates.status}`;
        statusElement.innerHTML = statusIcon;

        // Ajouter un titre pour les erreurs
        if (updates.status === 'error') {
          const errorMessage = updates.error || 'Erreur lors de l\'envoi';
          messageElement.title = errorMessage;
          statusElement.title = errorMessage;
        } else {
          messageElement.removeAttribute('title');
          statusElement.removeAttribute('title');
        }
      } else {
        console.warn('Élément de statut du message non trouvé');
      }
    }

    // Mettre à jour l'ID du message si nécessaire (pour les messages temporaires)
    if (updates._id && updates._id !== messageId) {
      messageElement.dataset.messageId = updates._id;
      console.log(`Mise à jour de l'ID du message de ${messageId} à ${updates._id}`);
    }

    // Mettre à jour l'horodatage si fourni
    if (updates.createdAt) {
      try {
        const timeElement = messageElement.querySelector('.message-time');
        if (timeElement) {
          const date = new Date(updates.createdAt);
          if (!isNaN(date.getTime())) {
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            // Préserver l'icône de statut si elle existe
            const statusHtml = timeElement.querySelector('.message-status')?.outerHTML || '';
            timeElement.innerHTML = `${timeString} ${statusHtml}`.trim();
          }
        }
      } catch (e) {
        console.error('Erreur lors de la mise à jour de la date du message:', e);
      }
    }

    console.log(`Statut du message ${messageId} mis à jour:`, updates);
  } catch (error) {
    console.error('Erreur dans updateMessageStatus:', error);
  }
}

updateConversationList(message) {
  // Trouver la conversation dans la liste
  const conversationIndex = this.conversations.findIndex(c =>
    c._id === message.conversation ||
    (message.conversation && c._id === message.conversation._id)
  );

  if (conversationIndex !== -1) {
    // Mettre à jour la conversation existante
    const conversation = this.conversations[conversationIndex];
    conversation.lastMessage = message;
    conversation.updatedAt = new Date();

    // Déplacer la conversation en haut de la liste
    this.conversations.splice(conversationIndex, 1);
    this.conversations.unshift(conversation);
  } else if (message.conversation) {
    // Ajouter une nouvelle conversation
    this.conversations.unshift({
      _id: message.conversation._id || message.conversation,
      participants: message.conversation.participants || [message.sender, this.currentUser.id],
      lastMessage: message,
      updatedAt: new Date()
    });
  }

  // Mettre à jour l'interface utilisateur
  this.renderConversationList();
}

updateUnreadCount(conversationId, count) {
  const conversationElement = document.querySelector(`[data-conversation-id="${conversationId}"]`);
  if (!conversationElement) return;

  let unreadBadge = conversationElement.querySelector('.unread-badge');

  if (count > 0) {
    if (!unreadBadge) {
      unreadBadge = document.createElement('span');
      unreadBadge.className = 'unread-badge';
      conversationElement.appendChild(unreadBadge);
    }
    unreadBadge.textContent = count > 9 ? '9+' : count;
    unreadBadge.style.display = 'inline-flex';
  } else if (unreadBadge) {
    unreadBadge.style.display = 'none';
  }
}

playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(e => console.warn('Impossible de lire le son de notification:', e));
  } catch (e) {
    console.warn('Erreur lors de la lecture du son de notification:', e);
  }
}

showDesktopNotification(title, body) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}

  async createNewConversation(e) {
  e.preventDefault();

  const recipientId = document.getElementById('recipientSelect').value;
  const subject = document.getElementById('messageSubject').value;
  const content = document.getElementById('messageContent').value;

  if (!recipientId || !content) return;

  try {
    const response = await apiRequest('/api/conversations', 'POST', {
      participantId: recipientId,
      subject: subject,
      initialMessage: content
    });

    if (response.success) {
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('newMessageModal'));
      modal.hide();
      // Restore focus to a visible control outside the modal to avoid aria-hidden focus
      setTimeout(() => {
        const focusTarget = document.querySelector('[data-focus-default]') || document.getElementById('searchConversations') || document.body;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus({ preventScroll: true });
        }
      }, 0);

      // Reset form
      e.target.reset();

      // Reload conversations
      await this.loadConversations();

      // Select the new conversation
      this.selectConversation(response.data._id);

      this.showAlert('Conversation créée avec succès', 'success');
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    this.showAlert('Erreur lors de la création de la conversation', 'danger');
  }
}

handleNewMessage(message) {
  try {
    if (!message) {
      console.error('Erreur: Message non défini');
      return;
    }

    console.log('=== NOUVEAU MESSAGE RECU ===');
    console.log('Message brut reçu:', message);

    // Vérifier si l'utilisateur est défini
    if (!this.currentUser || !this.currentUser.id) {
      console.error('Erreur: Utilisateur non connecté');
      return;
    }

    // Récupérer l'ID de la conversation du message
    let messageConversationId = message.conversationId ||
      (message.conversation &&
        (message.conversation._id || message.conversation.id));

    if (!messageConversationId) {
      console.error('Erreur: Impossible de déterminer la conversation du message');
      return;
    }

    // Normaliser l'expéditeur
    let senderInfo = {};
    if (message.sender) {
      if (typeof message.sender === 'string') {
        senderInfo = { _id: message.sender, name: 'Utilisateur inconnu' };
      } else {
        senderInfo = {
          _id: message.sender._id || message.sender.id || 'unknown',
          name: message.sender.name || 'Utilisateur inconnu',
          email: message.sender.email || ''
        };
      }
    }

    // Vérifier si le message est de l'utilisateur actuel
    const isOwnMessage = senderInfo._id === this.currentUser.id ||
      senderInfo._id === this.currentUser._id;

    // Normaliser le format du message
    const normalizedMessage = {
      _id: message._id || `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      content: message.content || '',
      sender: senderInfo,
      conversationId: messageConversationId,
      conversation: message.conversation || { _id: messageConversationId },
      status: isOwnMessage ? (message.status || 'sent') : 'received',
      createdAt: message.createdAt || new Date().toISOString(),
      updatedAt: message.updatedAt || new Date().toISOString()
    };

    console.log('Message normalisé:', normalizedMessage);

    // Vérifier si le message est pour la conversation actuelle
    const isForCurrentConversation = this.currentConversation &&
      (normalizedMessage.conversationId === this.currentConversation._id ||
        normalizedMessage.conversationId === this.currentConversation.id ||
        (typeof this.currentConversation._id === 'string' &&
          this.currentConversation._id === normalizedMessage.conversationId) ||
        (typeof this.currentConversation.id === 'string' &&
          this.currentConversation.id === normalizedMessage.conversationId));

    console.log('Conversation actuelle:', this.currentConversation?._id || this.currentConversation?.id);
    console.log('Message pour cette conversation?', isForCurrentConversation);

    // Mettre à jour la liste des conversations de manière asynchrone
    const updateConversations = async () => {
      try {
        console.log('Mise à jour de la liste des conversations...');
        await this.loadConversations();
        console.log('Liste des conversations mise à jour');

        // Mettre à jour le badge de notification si nécessaire
        const conversation = this.conversations.find(c =>
          c._id === messageConversationId || c.id === messageConversationId
        );

        if (conversation && conversation.unreadCount > 0) {
          this.updateUnreadCount(conversation._id || conversation.id, conversation.unreadCount);
        }
      } catch (error) {
        console.error('Erreur lors du rechargement des conversations:', error);
      }
    };

    // Si c'est pour la conversation actuelle, ajouter le message immédiatement
    if (isForCurrentConversation) {
      console.log('Ajout du message à la conversation actuelle');
      this.addMessageToChat(normalizedMessage);
    } else {
      console.log('Le message est pour une autre conversation ou aucune conversation n\'est sélectionnée');
      console.log('ID de la conversation du message:', messageConversationId);

      // Mettre à jour le compteur de messages non lus
      const conversation = this.conversations.find(c =>
        c._id === messageConversationId || c.id === messageConversationId
      );

      if (conversation) {
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        this.updateUnreadCount(conversation._id || conversation.id, conversation.unreadCount);
      }
    }

    // Mettre à jour la liste des conversations en arrière-plan
    updateConversations();

    // Afficher une notification si l'utilisateur n'est pas sur la conversation
    if (!isForCurrentConversation && !isOwnMessage) {
      console.log('Affichage d\'une notification pour le nouveau message');

      // Préparer le contenu de la notification
      const notificationTitle = 'Nouveau message';
      let notificationBody = 'Vous avez reçu un nouveau message';
      let senderName = senderInfo.name || 'Expéditeur inconnu';

      if (normalizedMessage.content) {
        // Limiter la longueur du message pour la notification
        const maxLength = 100;
        const content = normalizedMessage.content.length > maxLength
          ? normalizedMessage.content.substring(0, maxLength) + '...'
          : normalizedMessage.content;
        notificationBody = `${senderName}: ${content}`;
      }

      // Afficher la notification
      this.showNotification(notificationTitle, notificationBody, senderName);

      // Jouer un son de notification si disponible
      if (typeof this.playNotificationSound === 'function') {
        this.playNotificationSound();
      }
    }
  } catch (error) {
    console.error('Erreur lors du traitement du nouveau message:', error);
    // Tenter de récupérer en affichant au moins le contenu brut du message
    try {
      console.error('Détails du message en erreur:', JSON.stringify(message, null, 2));
    } catch (e) {
      console.error('Impossible de sérialiser le message:', e);
    }
  }
}

handleTyping() {
  if (!this.currentConversation) return;

  // Emit typing event
  this.socket.emit('typing', {
    conversationId: this.currentConversation._id,
    userId: this.currentUser.id
  });

  // Clear previous timeout
  if (this.typingTimeout) {
    clearTimeout(this.typingTimeout);
  }

  // Set timeout to stop typing
  this.typingTimeout = setTimeout(() => {
    this.socket.emit('stopTyping', {
      conversationId: this.currentConversation._id,
      userId: this.currentUser.id
    });
  }, 1000);
}

showTypingIndicator(data) {
  if (this.currentConversation && data.conversationId === this.currentConversation._id) {
    document.getElementById('typingIndicator').style.display = 'block';
  }
}

hideTypingIndicator(data) {
  if (this.currentConversation && data.conversationId === this.currentConversation._id) {
    document.getElementById('typingIndicator').style.display = 'none';
  }
}

populateUserSelect() {
  const select = document.getElementById('recipientSelect');
  if (!select) return;

  // Vider la liste déroulante
  select.innerHTML = '';

  const isAdmin = this.currentUser && this.currentUser.role === 'admin';

  // Ajouter l'option par défaut avec un message approprié
  const defaultOption = document.createElement('option');
  defaultOption.value = '';

  if (isAdmin) {
    defaultOption.textContent = this.users.length > 0
      ? 'Sélectionner un utilisateur...'
      : 'Aucun utilisateur disponible';
  } else {
    defaultOption.textContent = 'Sélectionner un contact...';
    // Pour les non-admins, on pourrait ajouter ici des contacts prédéfinis
    // ou des utilisateurs avec qui ils ont déjà discuté
  }

  select.appendChild(defaultOption);

  // Ajouter les utilisateurs disponibles (uniquement pour les admins)
  if (isAdmin) {
    this.users.forEach(user => {
      if (user && user._id && user.name && user.email) {
        const option = document.createElement('option');
        option.value = user._id;
        option.textContent = `${user.name} (${user.email})`;
        option.dataset.email = user.email; // Pour faciliter la recherche
        select.appendChild(option);
      }
    });
  } else {
    // Pour les non-admins, on pourrait ajouter des contacts prédéfinis
    // Par exemple, le support technique ou l'administration
    const supportOption = document.createElement('option');
    supportOption.value = 'support';
    supportOption.textContent = 'Support technique';
    supportOption.dataset.email = 'support@mairie-abeche.td';
    select.appendChild(supportOption);

    const adminOption = document.createElement('option');
    adminOption.value = 'admin';
    adminOption.textContent = 'Administration';
    adminOption.dataset.email = 'admin@mairie-abeche.td';
    select.appendChild(adminOption);
  }

  // Afficher un message d'aide sous la liste déroulante
  const helpText = document.getElementById('noUsersHelp');
  if (helpText) {
    if (isAdmin) {
      helpText.textContent = this.users.length === 0
        ? 'Aucun autre utilisateur trouvé.'
        : '';
    } else {
      helpText.textContent = 'Sélectionnez un contact pour démarrer une conversation.';
    }
  }

  // Activer la sélection maintenant qu'elle est peuplée
  select.disabled = false;
}

searchConversations(query) {
  const filteredConversations = this.conversations.filter(conv => {
    const otherParticipant = conv.participants.find(p => p._id !== this.currentUser.id);
    return otherParticipant?.name?.toLowerCase().includes(query.toLowerCase()) ||
      conv.lastMessage?.content?.toLowerCase().includes(query.toLowerCase());
  });

  this.displayConversations(filteredConversations);
}

  async markConversationAsRead(conversationId) {
  try {
    await apiRequest(`/api/conversations/${conversationId}/read`, 'POST');
  } catch (error) {
    console.error('Error marking conversation as read:', error);
  }
}

/**
 * Met à jour le statut en ligne d'un utilisateur dans l'interface
 * @param {string} userId - L'identifiant de l'utilisateur
 * @param {boolean} isOnline - Statut de connexion de l'utilisateur
 */
updateUserStatus(userId, isOnline) {
  if (!userId) {
    console.warn('ID utilisateur manquant pour la mise à jour du statut');
    return;
  }

  // Mettre à jour les indicateurs en ligne dans la liste des conversations
  const conversations = document.querySelectorAll('.conversation-item');
  conversations.forEach(conv => {
    // Mise à jour basée sur l'ID utilisateur si nécessaire
    const participantId = conv.dataset.userId;
    if (participantId === userId) {
      const indicator = conv.querySelector('.online-indicator');
      if (indicator) {
        indicator.style.display = isOnline ? 'inline-block' : 'none';
        indicator.title = isOnline ? 'En ligne' : 'Hors ligne';
      }
    }
  });
}

/**
 * Vérifie si un utilisateur est en ligne
 * @param {string} userId - L'ID de l'utilisateur à vérifier
 * @returns {boolean} - Vrai si l'utilisateur est en ligne
 */
isUserOnline(userId){
  if (!userId) return false;
  const onlineUsers = this.onlineUsers || [];
  return onlineUsers.includes(userId);
}

  async joinConversation(conversationId) {
  if (!this.socket || !this.socket.connected) {
    console.error('Impossible de rejoindre la conversation: Socket.IO non initialisé ou non connecté');
    return false;
  }

  if (!conversationId) {
    console.error('ID de conversation manquant');
    return false;
  }

  try {
    // Quitter la conversation précédente si nécessaire
    if (this.currentConversation && this.currentConversation._id !== conversationId) {
      this.socket.emit('leave-conversation', this.currentConversation._id);
    }

    // Rejoindre la nouvelle conversation
    this.socket.emit('join-conversation', {
      conversationId: conversationId,
      userId: this.currentUser.id
    });

    // Mettre à jour la conversation courante
    this.currentConversation = this.conversations.find(c => c._id === conversationId);

  } catch (error) {
    console.error('Erreur lors de la connexion à la conversation:', error);
    this.showAlert('Impossible de se connecter à la conversation', 'error');
  }
}

/**
 * Gère les mises à jour de conversation
 * @param {Object} data - Les données de mise à jour
 */
handleConversationUpdate(data) {
  if (data.type === 'newMessage' && data.message) {
    this.handleNewMessage(data.message);
  }
  // Ajouter d'autres types de mises à jour si nécessaire
}

getOtherParticipantId() {
  if (!this.currentConversation || !this.currentConversation.participants) {
    console.error('Impossible de déterminer le destinataire: conversation non définie');
    return null;
  }

  // Si c'est une conversation de groupe, on ne peut pas déterminer un seul destinataire
  if (this.currentConversation.isGroup) {
    console.error('Impossible de déterminer un destinataire unique pour une conversation de groupe');
    return null;
  }

  // Trouver l'ID du participant qui n'est pas l'utilisateur actuel
  const otherParticipant = this.currentConversation.participants.find(
    p => p._id !== this.currentUser.id && p._id.toString() !== this.currentUser.id.toString()
  );

  if (!otherParticipant) {
    console.error('Impossible de trouver le destinataire dans la conversation');
    return null;
  }

  return this.normalizeSender(otherParticipant)._id;
}

// Fait défiler la zone de discussion vers le bas
scrollToBottom() {
  const messagesContainer = document.getElementById('messagesList');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

showNotification(title, body, sender) {
  if (!('Notification' in window)) {
    console.warn('Ce navigateur ne supporte pas les notifications');
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(`${title} - ${sender}`, {
        body: body,
        icon: '/favicon.ico',
        silent: true
      });
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la notification:', error);
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        this.showNotification(title, body, sender);
      }
    });
  }
}

/**
 * Normalise l'objet expéditeur d'un message
 * @param {Object|string} sender - L'expéditeur à normaliser
 * @returns {Object} - L'expéditeur normalisé
 */
normalizeSender(sender) {
  if (!sender) {
    return { _id: 'unknown', name: 'Inconnu', email: '' };
  }

  if (typeof sender === 'string') {
    return {
      _id: sender,
      name: 'Utilisateur inconnu',
      email: ''
    };
  }

  return {
    _id: sender._id || 'unknown',
    name: sender.name || 'Utilisateur inconnu',
    email: sender.email || ''
  };
}
}

// Export global de la classe
if (typeof window !== 'undefined') {
  window.MessageSystem = MessageSystem;
}