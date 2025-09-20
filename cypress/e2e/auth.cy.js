describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear localStorage and cookies before each test
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Mock API endpoints
    cy.intercept('POST', '/api/auth/login', { fixture: 'auth/login-success.json' }).as('login');
    cy.intercept('POST', '/api/auth/register', { fixture: 'auth/register-success.json' }).as('register');
    cy.intercept('POST', '/api/auth/logout', { statusCode: 200 }).as('logout');
    cy.intercept('GET', '/api/auth/me', { fixture: 'auth/user-profile.json' }).as('getProfile');
  });

  describe('Login', () => {
    it('should display login form', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="login-form"]').should('be.visible');
      cy.get('[data-testid="email-input"]').should('be.visible');
      cy.get('[data-testid="password-input"]').should('be.visible');
      cy.get('[data-testid="login-button"]').should('be.visible');
      cy.get('[data-testid="register-link"]').should('be.visible');
    });

    it('should show validation errors for empty fields', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-error"]').should('contain', 'Email is required');
      cy.get('[data-testid="password-error"]').should('contain', 'Password is required');
    });

    it('should show validation error for invalid email', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('invalid-email');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-error"]').should('contain', 'Please enter a valid email');
    });

    it('should successfully login with valid credentials', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();
      
      cy.wait('@login');
      
      // Should redirect to chat interface
      cy.url().should('include', '/chat');
      
      // Should store token in localStorage
      cy.window().its('localStorage').invoke('getItem', 'token').should('exist');
    });

    it('should handle login errors gracefully', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: { message: 'Invalid credentials' }
      }).as('loginError');
      
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('wrongpassword');
      cy.get('[data-testid="login-button"]').click();
      
      cy.wait('@loginError');
      
      cy.get('[data-testid="error-message"]').should('contain', 'Invalid credentials');
      cy.url().should('include', '/login');
    });

    it('should show loading state during login', () => {
      cy.intercept('POST', '/api/auth/login', {
        delay: 2000,
        fixture: 'auth/login-success.json'
      }).as('slowLogin');
      
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="login-button"]').should('be.disabled');
      cy.get('[data-testid="loading-spinner"]').should('be.visible');
      
      cy.wait('@slowLogin');
      
      cy.url().should('include', '/chat');
    });

    it('should toggle password visibility', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'password');
      
      cy.get('[data-testid="toggle-password"]').click();
      
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'text');
      
      cy.get('[data-testid="toggle-password"]').click();
      
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'password');
    });
  });

  describe('Registration', () => {
    it('should display registration form', () => {
      cy.visit('/register');
      
      cy.get('[data-testid="register-form"]').should('be.visible');
      cy.get('[data-testid="name-input"]').should('be.visible');
      cy.get('[data-testid="email-input"]').should('be.visible');
      cy.get('[data-testid="password-input"]').should('be.visible');
      cy.get('[data-testid="confirm-password-input"]').should('be.visible');
      cy.get('[data-testid="register-button"]').should('be.visible');
      cy.get('[data-testid="login-link"]').should('be.visible');
    });

    it('should validate password confirmation', () => {
      cy.visit('/register');
      
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('differentpassword');
      cy.get('[data-testid="register-button"]').click();
      
      cy.get('[data-testid="confirm-password-error"]').should('contain', 'Passwords do not match');
    });

    it('should successfully register new user', () => {
      cy.visit('/register');
      
      cy.get('[data-testid="name-input"]').type('Test User');
      cy.get('[data-testid="email-input"]').type('newuser@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('password123');
      cy.get('[data-testid="register-button"]').click();
      
      cy.wait('@register');
      
      // Should redirect to chat interface
      cy.url().should('include', '/chat');
      
      // Should store token in localStorage
      cy.window().its('localStorage').invoke('getItem', 'token').should('exist');
    });

    it('should handle registration errors', () => {
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 409,
        body: { message: 'Email already exists' }
      }).as('registerError');
      
      cy.visit('/register');
      
      cy.get('[data-testid="name-input"]').type('Test User');
      cy.get('[data-testid="email-input"]').type('existing@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('password123');
      cy.get('[data-testid="register-button"]').click();
      
      cy.wait('@registerError');
      
      cy.get('[data-testid="error-message"]').should('contain', 'Email already exists');
    });
  });

  describe('Phone Authentication', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/auth/phone/send-code', { 
        statusCode: 200,
        body: { message: 'Code sent successfully' }
      }).as('sendCode');
      
      cy.intercept('POST', '/api/auth/phone/verify-code', { 
        fixture: 'auth/phone-verify-success.json'
      }).as('verifyCode');
    });

    it('should send verification code', () => {
      cy.visit('/phone-auth');
      
      cy.get('[data-testid="phone-input"]').type('+1234567890');
      cy.get('[data-testid="send-code-button"]').click();
      
      cy.wait('@sendCode');
      
      cy.get('[data-testid="verification-code-input"]').should('be.visible');
      cy.get('[data-testid="verify-button"]').should('be.visible');
      cy.get('[data-testid="resend-code-button"]').should('be.visible');
    });

    it('should verify phone number with correct code', () => {
      cy.visit('/phone-auth');
      
      // Send code first
      cy.get('[data-testid="phone-input"]').type('+1234567890');
      cy.get('[data-testid="send-code-button"]').click();
      cy.wait('@sendCode');
      
      // Enter verification code
      cy.get('[data-testid="verification-code-input"]').type('123456');
      cy.get('[data-testid="verify-button"]').click();
      
      cy.wait('@verifyCode');
      
      cy.url().should('include', '/chat');
    });

    it('should handle invalid verification code', () => {
      cy.intercept('POST', '/api/auth/phone/verify-code', {
        statusCode: 400,
        body: { message: 'Invalid verification code' }
      }).as('verifyCodeError');
      
      cy.visit('/phone-auth');
      
      // Send code first
      cy.get('[data-testid="phone-input"]').type('+1234567890');
      cy.get('[data-testid="send-code-button"]').click();
      cy.wait('@sendCode');
      
      // Enter wrong code
      cy.get('[data-testid="verification-code-input"]').type('000000');
      cy.get('[data-testid="verify-button"]').click();
      
      cy.wait('@verifyCodeError');
      
      cy.get('[data-testid="error-message"]').should('contain', 'Invalid verification code');
    });

    it('should allow code resend after timeout', () => {
      cy.visit('/phone-auth');
      
      // Send initial code
      cy.get('[data-testid="phone-input"]').type('+1234567890');
      cy.get('[data-testid="send-code-button"]').click();
      cy.wait('@sendCode');
      
      // Resend button should be disabled initially
      cy.get('[data-testid="resend-code-button"]').should('be.disabled');
      
      // Wait for resend timeout (mocked)
      cy.wait(3000);
      
      // Resend button should be enabled
      cy.get('[data-testid="resend-code-button"]').should('not.be.disabled');
      
      // Click resend
      cy.get('[data-testid="resend-code-button"]').click();
      cy.wait('@sendCode');
      
      cy.get('[data-testid="success-message"]').should('contain', 'Code sent successfully');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      // Login first
      cy.window().then((win) => {
        win.localStorage.setItem('token', 'mock-token');
        win.localStorage.setItem('user', JSON.stringify({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    it('should logout successfully', () => {
      cy.visit('/chat');
      
      // Open user menu
      cy.get('[data-testid="user-menu-button"]').click();
      
      // Click logout
      cy.get('[data-testid="logout-button"]').click();
      
      cy.wait('@logout');
      
      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Should clear localStorage
      cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
      cy.window().its('localStorage').invoke('getItem', 'user').should('be.null');
    });

    it('should show logout confirmation dialog', () => {
      cy.visit('/chat');
      
      cy.get('[data-testid="user-menu-button"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.get('[data-testid="logout-confirmation"]').should('be.visible');
      cy.get('[data-testid="confirm-logout"]').should('be.visible');
      cy.get('[data-testid="cancel-logout"]').should('be.visible');
    });

    it('should cancel logout when user clicks cancel', () => {
      cy.visit('/chat');
      
      cy.get('[data-testid="user-menu-button"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.get('[data-testid="cancel-logout"]').click();
      
      // Should stay on chat page
      cy.url().should('include', '/chat');
      
      // Token should still exist
      cy.window().its('localStorage').invoke('getItem', 'token').should('exist');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without token', () => {
      cy.visit('/chat');
      
      cy.url().should('include', '/login');
    });

    it('should allow access to protected route with valid token', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('token', 'valid-token');
        win.localStorage.setItem('user', JSON.stringify({
          id: 'user-123',
          name: 'Test User'
        }));
      });
      
      cy.visit('/chat');
      
      cy.url().should('include', '/chat');
      cy.get('[data-testid="chat-interface"]').should('be.visible');
    });

    it('should redirect to login when token is invalid', () => {
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 401,
        body: { message: 'Invalid token' }
      }).as('invalidToken');
      
      cy.window().then((win) => {
        win.localStorage.setItem('token', 'invalid-token');
      });
      
      cy.visit('/chat');
      
      cy.wait('@invalidToken');
      
      cy.url().should('include', '/login');
    });
  });

  describe('Remember Me Functionality', () => {
    it('should persist login when remember me is checked', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="remember-me-checkbox"]').check();
      cy.get('[data-testid="login-button"]').click();
      
      cy.wait('@login');
      
      // Reload page to simulate browser restart
      cy.reload();
      
      // Should still be logged in
      cy.url().should('include', '/chat');
    });

    it('should not persist login when remember me is unchecked', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="remember-me-checkbox"]').should('not.be.checked');
      cy.get('[data-testid="login-button"]').click();
      
      cy.wait('@login');
      
      // Clear session storage to simulate browser close
      cy.clearLocalStorage();
      cy.reload();
      
      // Should redirect to login
      cy.url().should('include', '/login');
    });
  });

  describe('Social Authentication', () => {
    it('should initiate Google OAuth flow', () => {
      cy.visit('/login');
      
      // Mock window.open for OAuth popup
      cy.window().then((win) => {
        cy.stub(win, 'open').as('windowOpen');
      });
      
      cy.get('[data-testid="google-login-button"]').click();
      
      cy.get('@windowOpen').should('have.been.calledWith', 
        Cypress.sinon.match(/google\.com.*oauth/), 
        'google-oauth',
        Cypress.sinon.match.string
      );
    });

    it('should handle successful OAuth callback', () => {
      cy.intercept('GET', '/api/auth/oauth/callback*', {
        fixture: 'auth/oauth-success.json'
      }).as('oauthCallback');
      
      cy.visit('/auth/callback?code=oauth-code&state=oauth-state');
      
      cy.wait('@oauthCallback');
      
      cy.url().should('include', '/chat');
    });

    it('should handle OAuth errors', () => {
      cy.intercept('GET', '/api/auth/oauth/callback*', {
        statusCode: 400,
        body: { message: 'OAuth authentication failed' }
      }).as('oauthError');
      
      cy.visit('/auth/callback?error=access_denied');
      
      cy.wait('@oauthError');
      
      cy.url().should('include', '/login');
      cy.get('[data-testid="error-message"]').should('contain', 'OAuth authentication failed');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      cy.visit('/login');
      
      // Tab through form elements
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'email-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'password-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'login-button');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').should('have.attr', 'aria-label', 'Email address');
      cy.get('[data-testid="password-input"]').should('have.attr', 'aria-label', 'Password');
      cy.get('[data-testid="login-button"]').should('have.attr', 'aria-label', 'Sign in');
    });

    it('should announce form errors to screen readers', () => {
      cy.visit('/login');
      
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-error"]')
        .should('have.attr', 'role', 'alert')
        .should('have.attr', 'aria-live', 'polite');
    });
  });
});
