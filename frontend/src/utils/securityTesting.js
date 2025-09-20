// Security testing utilities for WhatsApp clone
class SecurityTester {
  constructor() {
    this.vulnerabilities = [];
    this.testResults = [];
  }

  // Test for XSS vulnerabilities
  testXSSVulnerabilities(inputFields = []) {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload="alert(\'XSS\')">',
      '"><script>alert("XSS")</script>'
    ];

    const results = {
      testName: 'XSS Vulnerability Test',
      vulnerabilitiesFound: [],
      inputsTested: inputFields.length,
      timestamp: Date.now()
    };

    inputFields.forEach((field, fieldIndex) => {
      xssPayloads.forEach(payload => {
        const testResult = this.simulateXSSInjection(field, payload);
        if (testResult.vulnerable) {
          results.vulnerabilitiesFound.push({
            field: field.name || `field-${fieldIndex}`,
            payload: payload,
            severity: this.classifyXSSSeverity(payload),
            mitigation: 'Implement input sanitization and CSP'
          });
        }
      });
    });

    results.status = results.vulnerabilitiesFound.length === 0 ? 'PASS' : 'FAIL';
    this.testResults.push(results);
    return results;
  }

  // Test authentication security
  testAuthenticationSecurity(authConfig = {}) {
    const results = {
      testName: 'Authentication Security Test',
      vulnerabilitiesFound: [],
      timestamp: Date.now()
    };

    // Test password strength
    if (!authConfig.passwordPolicy?.minLength || authConfig.passwordPolicy.minLength < 8) {
      results.vulnerabilitiesFound.push({
        vulnerability: 'Weak Password Policy',
        severity: 'MEDIUM',
        mitigation: 'Enforce minimum 8 character passwords'
      });
    }

    // Test session security
    if (!authConfig.sessionConfig?.httpOnly) {
      results.vulnerabilitiesFound.push({
        vulnerability: 'Session Cookie Not HttpOnly',
        severity: 'MEDIUM',
        mitigation: 'Set HttpOnly flag on session cookies'
      });
    }

    results.status = results.vulnerabilitiesFound.length === 0 ? 'PASS' : 'FAIL';
    this.testResults.push(results);
    return results;
  }

  // Test file upload security
  testFileUploadSecurity(uploadConfig = {}) {
    const results = {
      testName: 'File Upload Security Test',
      vulnerabilitiesFound: [],
      timestamp: Date.now()
    };

    const maliciousFiles = [
      { name: 'script.js', type: 'application/javascript' },
      { name: 'shell.php', type: 'application/x-php' },
      { name: '../../etc/passwd', type: 'text/plain' }
    ];

    maliciousFiles.forEach(file => {
      const testResult = this.simulateFileUpload(file, uploadConfig);
      if (testResult.vulnerable) {
        results.vulnerabilitiesFound.push({
          fileName: file.name,
          vulnerability: testResult.vulnerability,
          severity: testResult.severity,
          mitigation: testResult.mitigation
        });
      }
    });

    results.status = results.vulnerabilitiesFound.length === 0 ? 'PASS' : 'FAIL';
    this.testResults.push(results);
    return results;
  }

  // Test for sensitive data exposure
  testSensitiveDataExposure() {
    const results = {
      testName: 'Sensitive Data Exposure Test',
      vulnerabilitiesFound: [],
      timestamp: Date.now()
    };

    // Check localStorage
    const sensitivePatterns = [/password/i, /secret/i, /token/i];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      
      if (sensitivePatterns.some(pattern => pattern.test(key) || pattern.test(value))) {
        results.vulnerabilitiesFound.push({
          vulnerability: 'Sensitive Data in localStorage',
          description: `Sensitive data in key: ${key}`,
          severity: 'MEDIUM',
          mitigation: 'Avoid storing sensitive data in localStorage'
        });
      }
    }

    results.status = results.vulnerabilitiesFound.length === 0 ? 'PASS' : 'FAIL';
    this.testResults.push(results);
    return results;
  }

  // Simulate XSS injection
  simulateXSSInjection(field, payload) {
    const testElement = document.createElement('div');
    try {
      testElement.innerHTML = payload;
      const scriptElements = testElement.querySelectorAll('script');
      const eventHandlers = testElement.innerHTML.match(/on\w+\s*=/gi);
      
      if (scriptElements.length > 0 || eventHandlers) {
        return { vulnerable: true };
      }
    } catch (error) {
      return { vulnerable: true };
    }
    return { vulnerable: false };
  }

  // Simulate file upload
  simulateFileUpload(file, uploadConfig = {}) {
    const allowedTypes = uploadConfig.allowedFileTypes || ['image/jpeg', 'image/png'];
    
    if (!allowedTypes.includes(file.type)) {
      const dangerousTypes = ['application/javascript', 'application/x-php'];
      if (dangerousTypes.includes(file.type)) {
        return {
          vulnerable: true,
          vulnerability: 'Dangerous File Type',
          severity: 'HIGH',
          mitigation: 'Implement strict file type validation'
        };
      }
    }

    if (file.name.includes('../')) {
      return {
        vulnerable: true,
        vulnerability: 'Path Traversal',
        severity: 'HIGH',
        mitigation: 'Sanitize file names'
      };
    }

    return { vulnerable: false };
  }

  // Utility functions
  classifyXSSSeverity(payload) {
    if (payload.includes('<script>')) return 'HIGH';
    if (payload.includes('onerror')) return 'MEDIUM';
    return 'LOW';
  }

  calculateRiskLevel(vulnerabilities) {
    if (vulnerabilities.length === 0) return 'LOW';
    const severities = vulnerabilities.map(v => v.severity);
    if (severities.includes('CRITICAL')) return 'CRITICAL';
    if (severities.includes('HIGH')) return 'HIGH';
    if (severities.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  // Generate security report
  generateSecurityReport() {
    return {
      summary: {
        totalTests: this.testResults.length,
        totalVulnerabilities: this.testResults.reduce((sum, test) => sum + test.vulnerabilitiesFound.length, 0),
        overallRiskLevel: this.calculateOverallRisk(),
        timestamp: Date.now()
      },
      testResults: this.testResults,
      recommendations: this.generateRecommendations()
    };
  }

  calculateOverallRisk() {
    const allVulns = this.testResults.flatMap(test => test.vulnerabilitiesFound);
    return this.calculateRiskLevel(allVulns);
  }

  generateRecommendations() {
    const recommendations = [];
    this.testResults.forEach(test => {
      if (test.vulnerabilitiesFound.length > 0) {
        recommendations.push(`Address ${test.testName} vulnerabilities`);
      }
    });
    return recommendations;
  }

  // Clear results
  clearResults() {
    this.testResults = [];
    this.vulnerabilities = [];
  }
}

// Create singleton instance
const securityTester = new SecurityTester();

// Export utility functions
export const testXSSVulnerabilities = (fields) => securityTester.testXSSVulnerabilities(fields);
export const testAuthenticationSecurity = (config) => securityTester.testAuthenticationSecurity(config);
export const testFileUploadSecurity = (config) => securityTester.testFileUploadSecurity(config);
export const testSensitiveDataExposure = () => securityTester.testSensitiveDataExposure();
export const generateSecurityReport = () => securityTester.generateSecurityReport();

export default securityTester;
