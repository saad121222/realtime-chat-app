describe('Chat Functionality', () => {
  beforeEach(() => {
    // Setup authenticated user
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'mock-token');
      win.localStorage.setItem('user', JSON.stringify({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });

    // Mock API endpoints
    cy.intercept('GET', '/api/chats', { fixture: 'chat/chats-list.json' }).as('getChats');
    cy.intercept('GET', '/api/chats/*/messages*', { fixture: 'chat/messages.json' }).as('getMessages');
    cy.intercept('POST', '/api/chats/*/messages', { fixture: 'chat/send-message.json' }).as('sendMessage');
    cy.intercept('POST', '/api/chats', { fixture: 'chat/new-chat.json' }).as('createChat');
  });

  describe('Chat List', () => {
    it('should display chat list on load', () => {
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('[data-testid="chat-list"]').should('be.visible');
      cy.get('[data-testid="chat-item"]').should('have.length.greaterThan', 0);
    });

    it('should show unread message count', () => {
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('[data-testid="chat-item"]').first().within(() => {
        cy.get('[data-testid="unread-count"]').should('be.visible');
      });
    });

    it('should filter chats by search', () => {
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('[data-testid="chat-search"]').type('John');
      cy.get('[data-testid="chat-item"]').should('have.length', 1);
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      cy.visit('/chat');
      cy.wait('@getChats');
      cy.get('[data-testid="chat-item"]').first().click();
      cy.wait('@getMessages');
    });

    it('should send text message', () => {
      const messageText = 'Hello, test message!';
      
      cy.get('[data-testid="message-input"]').type(`${messageText}{enter}`);
      cy.wait('@sendMessage');
      
      cy.get('[data-testid="message"]').last().should('contain', messageText);
      cy.get('[data-testid="message-input"]').should('have.value', '');
    });

    it('should not send empty messages', () => {
      cy.get('[data-testid="message-input"]').type('   {enter}');
      cy.get('@sendMessage').should('not.exist');
    });
  });

  describe('File Upload', () => {
    beforeEach(() => {
      cy.visit('/chat');
      cy.wait('@getChats');
      cy.get('[data-testid="chat-item"]').first().click();
      cy.wait('@getMessages');
      
      cy.intercept('POST', '/api/files/upload', { fixture: 'chat/file-upload.json' }).as('uploadFile');
    });

    it('should upload image file', () => {
      cy.get('[data-testid="attachment-button"]').click();
      cy.get('[data-testid="upload-image"]').click();
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('fake-image-data'),
        fileName: 'test.jpg',
        mimeType: 'image/jpeg'
      }, { force: true });
      
      cy.wait('@uploadFile');
      cy.get('[data-testid="send-file-button"]').click();
      cy.wait('@sendMessage');
      
      cy.get('[data-testid="message"]').last().within(() => {
        cy.get('[data-testid="message-image"]').should('be.visible');
      });
    });
  });

  describe('Real-time Features', () => {
    beforeEach(() => {
      cy.visit('/chat');
      cy.wait('@getChats');
      cy.get('[data-testid="chat-item"]').first().click();
      cy.wait('@getMessages');
    });

    it('should show typing indicator', () => {
      cy.get('[data-testid="message-input"]').type('Typing...');
      
      // Should show typing indicator for other users
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('socket-typing', { 
          detail: { userId: 'user-456', isTyping: true } 
        }));
      });
      
      cy.get('[data-testid="typing-indicator"]').should('be.visible');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt to mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('[data-testid="chat-list"]').should('be.visible');
      
      cy.get('[data-testid="chat-item"]').first().click();
      cy.wait('@getMessages');
      
      cy.get('[data-testid="chat-window"]').should('be.visible');
      cy.get('[data-testid="back-button"]').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'chat-search');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid').and('include', 'chat-item');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/chat');
      cy.wait('@getChats');
      
      cy.get('[data-testid="chat-list"]').should('have.attr', 'role', 'list');
      cy.get('[data-testid="chat-item"]').should('have.attr', 'role', 'listitem');
    });
  });
});
