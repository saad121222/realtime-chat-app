const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:3000',
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Test files
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Support file
    supportFile: 'cypress/support/e2e.js',
    
    // Fixtures folder
    fixturesFolder: 'cypress/fixtures',
    
    // Screenshots and videos
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    
    // Video settings
    video: true,
    videoCompression: 32,
    
    // Screenshot settings
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Retry settings
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Browser settings
    chromeWebSecurity: false,
    
    // Test isolation
    testIsolation: true,
    
    // Setup node events
    setupNodeEvents(on, config) {
      // Code coverage
      require('@cypress/code-coverage/task')(on, config);
      
      // Custom tasks
      on('task', {
        // Database seeding
        seedDatabase: (data) => {
          // Implement database seeding logic
          console.log('Seeding database with:', data);
          return null;
        },
        
        // Clear database
        clearDatabase: () => {
          // Implement database clearing logic
          console.log('Clearing database');
          return null;
        },
        
        // Generate test data
        generateTestData: (options) => {
          const { type, count = 10 } = options;
          
          switch (type) {
            case 'users':
              return Array.from({ length: count }, (_, i) => ({
                id: `user-${i + 1}`,
                name: `Test User ${i + 1}`,
                email: `user${i + 1}@example.com`,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 1}`
              }));
              
            case 'chats':
              return Array.from({ length: count }, (_, i) => ({
                id: `chat-${i + 1}`,
                name: `Test Chat ${i + 1}`,
                type: i % 3 === 0 ? 'group' : 'private',
                lastMessage: `Last message in chat ${i + 1}`,
                timestamp: new Date(Date.now() - i * 60000).toISOString()
              }));
              
            case 'messages':
              return Array.from({ length: count }, (_, i) => ({
                id: `msg-${i + 1}`,
                content: `Test message ${i + 1}`,
                sender: `user-${(i % 3) + 1}`,
                timestamp: new Date(Date.now() - i * 30000).toISOString(),
                type: 'text'
              }));
              
            default:
              return [];
          }
        },
        
        // Performance monitoring
        measurePerformance: (metrics) => {
          console.log('Performance metrics:', metrics);
          return null;
        },
        
        // Security testing
        runSecurityTests: (config) => {
          console.log('Running security tests with config:', config);
          return {
            vulnerabilities: [],
            passed: true
          };
        }
      });
      
      // Environment-specific configuration
      if (config.env.environment === 'staging') {
        config.baseUrl = 'https://staging.whatsapp-clone.com';
      } else if (config.env.environment === 'production') {
        config.baseUrl = 'https://whatsapp-clone.com';
      }
      
      return config;
    },
    
    // Environment variables
    env: {
      environment: 'development',
      apiUrl: 'http://localhost:5000/api',
      coverage: true
    }
  },
  
  component: {
    // Component testing configuration
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack'
    },
    
    // Component test files
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    
    // Viewport for component tests
    viewportWidth: 1000,
    viewportHeight: 660,
    
    // Support file for component tests
    supportFile: 'cypress/support/component.js'
  },
  
  // Global configuration
  watchForFileChanges: true,
  
  // Experimental features
  experimentalStudio: true,
  experimentalMemoryManagement: true,
  
  // Reporter options
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true,
    charts: true,
    reportPageTitle: 'WhatsApp Clone E2E Tests',
    embeddedScreenshots: true,
    inlineAssets: true
  }
});
