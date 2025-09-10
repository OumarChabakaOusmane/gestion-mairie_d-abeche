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
      // Initialize Socket.IO connection
      this.socket = io();
      this.setupSocketEvents();
      
      // Load initial data
      await this.loadUsers();
      await this.loadConversations();
      
      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du système de messagerie');
    }
  }

  setupSocketEvents() {
    if (!this.socket) return;

    try {
      // Join user room
      this.socket.emit('join', this.currentUser.id);

      // Listen for new messages
      this.socket.on('newMessage', (message) => {
        this.handleNewMessage(message);
      });

      // Listen for typing indicators
      this.socket.on('userTyping', (data) => {
        this.showTypingIndicator(data);
      });

      this.socket.on('userStoppedTyping', (data) => {
        this.hideTypingIndicator(data);
    });

      // Listen for user status updates
      this.socket.on('userOnline', (userId) => {
        this.updateUserStatus(userId, true);
      });

      this.socket.on('userOffline', (userId) => {
        this.updateUserStatus(userId, false);
      });

      // Gestion des erreurs de connexion
      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.socket = null;
      });

      this.socket.on('disconnect', (reason) => {
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
        `;
      }
    }
  }

  async loadUsers() {
    try {
      const response = await apiRequest('/api/users', 'GET');
      if (response.success) {
        this.users = response.data.filter(user => user._id !== this.currentUser.id);
        this.populateUserSelect();
      }
    } catch (error) {
      console.error('Error loading users:', error);
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

  async selectConversation(conversationId) {
    try {
      const conversation = this.conversations.find(c => c._id === conversationId);
      if (!conversation) return;

      this.currentConversation = conversation;
      
      // Update active conversation in UI
      document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');

      // Load messages for this conversation
      await this.loadMessages(conversationId);
      
      // Show message input
      document.getElementById('messageInputContainer').style.display = 'block';
      
      // Update header
      this.updateConversationHeader(conversation);
      
      // Mark as read
      await this.markConversationAsRead(conversationId);
      
    } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  }

  async loadMessages(conversationId) {
    try {
      const response = await apiRequest(`/api/conversations/${conversationId}/messages`, 'GET');
      if (response.success) {
        this.displayMessages(response.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  displayMessages(messages) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;

    if (messages.length === 0) {
      messagesList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comment"></i>
          <p>Aucun message dans cette conversation</p>
        </div>
      `;
      return;
    }

    messagesList.innerHTML = messages.map(message => {
      const isOwn = message.sender._id === this.currentUser.id;
      return `
        <div class="message-item ${isOwn ? 'own' : ''}">
          ${!isOwn ? `<div class="user-avatar">${message.sender.name?.charAt(0).toUpperCase() || 'U'}</div>` : ''}
          <div class="message-content">
            <div class="message-text">${this.escapeHtml(message.content)}</div>
            <div class="message-time">${this.formatTime(message.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  updateConversationHeader(conversation) {
    const header = document.getElementById('conversationHeader');
    if (!header) return;

    const otherParticipant = conversation.participants.find(p => p._id !== this.currentUser.id);
    
    header.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="user-avatar me-3">
          ${otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div>
          <h5 class="mb-0">${otherParticipant?.name || 'Utilisateur inconnu'}</h5>
          <small class="text-muted">
            ${this.isUserOnline(otherParticipant?._id) ? 'En ligne' : 'Hors ligne'}
          </small>
        </div>
      </div>
    `;
  }

  async sendMessage(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content || !this.currentConversation) return;

    try {
      const response = await apiRequest(`/api/conversations/${this.currentConversation._id}/messages`, 'POST', {
        content: content
      });

      if (response.success) {
        messageInput.value = '';
        
        // Emit message via socket
        this.socket.emit('sendMessage', {
          conversationId: this.currentConversation._id,
          content: content,
          sender: this.currentUser
        });
        
        // Add message to UI immediately
        this.addMessageToUI({
          _id: response.data._id,
          content: content,
          sender: this.currentUser,
          createdAt: new Date().toISOString()
        });
        
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.showAlert('Erreur lors de l\'envoi du message', 'danger');
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
    if (this.currentConversation && message.conversationId === this.currentConversation._id) {
      this.addMessageToUI(message);
    }
    
    // Update conversations list
    this.loadConversations();
    
    // Show notification if not in current conversation
    if (!this.currentConversation || message.conversationId !== this.currentConversation._id) {
      this.showNotification('Nouveau message', message.content, message.sender.name);
    }
  }

  addMessageToUI(message) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;

    const isOwn = message.sender._id === this.currentUser.id;
    const messageElement = document.createElement('div');
    messageElement.className = `message-item ${isOwn ? 'own' : ''}`;
    
    messageElement.innerHTML = `
      ${!isOwn ? `<div class="user-avatar">${message.sender.name?.charAt(0).toUpperCase() || 'U'}</div>` : ''}
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(message.content)}</div>
        <div class="message-time">${this.formatTime(message.createdAt)}</div>
      </div>
    `;

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
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

    select.innerHTML = '<option value="">Sélectionner un utilisateur...</option>';
    
    this.users.forEach(user => {
      const option = document.createElement('option');
      option.value = user._id;
      option.textContent = `${user.name} (${user.email})`;
      select.appendChild(option);
    });
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

  updateUserStatus(userId, isOnline) {
    // Update online indicators in conversations list
    const conversations = document.querySelectorAll('.conversation-item');
    conversations.forEach(conv => {
      // Update based on user ID if needed
    });
  }

  isUserOnline(userId) {
    // This would be implemented with real-time user status
    return Math.random() > 0.5; // Mock implementation
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showAlert(message, type = 'info') {
    // Create and show bootstrap alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }

  showNotification(title, body, sender) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${title} - ${sender}`, {
        body: body,
        icon: '/favicon.ico'
      });
    }
  }
}

// Make MessageSystem available globally
window.MessageSystem = MessageSystem;