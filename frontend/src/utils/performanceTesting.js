// Performance testing utilities for WhatsApp clone
class PerformanceTester {
  constructor() {
    this.results = [];
    this.isRunning = false;
  }

  // Measure execution time of a function
  async measurePerformance(name, fn, options = {}) {
    const { iterations = 1, warmup = 0 } = options;
    
    // Warmup runs
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    const measurements = [];
    
    for (let i = 0; i < iterations; i++) {
      const startMark = `${name}-start-${i}`;
      const endMark = `${name}-end-${i}`;
      const measureName = `${name}-${i}`;
      
      performance.mark(startMark);
      const startTime = performance.now();
      
      let result;
      try {
        result = await fn();
      } catch (error) {
        performance.mark(endMark);
        throw error;
      }
      
      const endTime = performance.now();
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      
      measurements.push({
        iteration: i,
        duration: endTime - startTime,
        result: i === 0 ? result : undefined // Only store result from first iteration
      });
    }

    const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
    const minDuration = Math.min(...measurements.map(m => m.duration));
    const maxDuration = Math.max(...measurements.map(m => m.duration));
    
    const performanceResult = {
      name,
      iterations,
      averageDuration: avgDuration,
      minDuration,
      maxDuration,
      standardDeviation: this.calculateStandardDeviation(measurements.map(m => m.duration)),
      result: measurements[0].result,
      timestamp: Date.now(),
      measurements: measurements.map(m => ({ iteration: m.iteration, duration: m.duration }))
    };

    this.results.push(performanceResult);
    return performanceResult;
  }

  // Run load testing with concurrent operations
  async runLoadTest(operation, options = {}) {
    const {
      concurrency = 10,
      iterations = 100,
      rampUpTime = 0,
      timeout = 30000
    } = options;

    const results = {
      totalOperations: concurrency * iterations,
      successfulOperations: 0,
      failedOperations: 0,
      timeouts: 0,
      responseTimes: [],
      errors: [],
      startTime: Date.now(),
      endTime: null
    };

    const runBatch = async (batchIndex) => {
      const batchPromises = [];
      
      for (let i = 0; i < concurrency; i++) {
        const operationPromise = this.runSingleOperation(operation, timeout);
        batchPromises.push(operationPromise);
        
        // Ramp up delay
        if (rampUpTime > 0 && i < concurrency - 1) {
          await this.sleep(rampUpTime / concurrency);
        }
      }
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.successfulOperations++;
          results.responseTimes.push(result.value.duration);
        } else {
          results.failedOperations++;
          if (result.reason.name === 'TimeoutError') {
            results.timeouts++;
          }
          results.errors.push(`Batch ${batchIndex}, Operation ${index}: ${result.reason.message}`);
        }
      });
    };

    // Run all batches
    const batchPromises = [];
    for (let batch = 0; batch < iterations; batch++) {
      batchPromises.push(runBatch(batch));
    }

    await Promise.all(batchPromises);
    
    results.endTime = Date.now();
    results.totalDuration = results.endTime - results.startTime;
    
    // Calculate statistics
    if (results.responseTimes.length > 0) {
      results.averageResponseTime = results.responseTimes.reduce((sum, time) => sum + time, 0) / results.responseTimes.length;
      results.minResponseTime = Math.min(...results.responseTimes);
      results.maxResponseTime = Math.max(...results.responseTimes);
      results.medianResponseTime = this.calculateMedian(results.responseTimes);
      results.p95ResponseTime = this.calculatePercentile(results.responseTimes, 95);
      results.p99ResponseTime = this.calculatePercentile(results.responseTimes, 99);
    }
    
    results.operationsPerSecond = (results.successfulOperations / results.totalDuration) * 1000;
    results.errorRate = (results.failedOperations / results.totalOperations) * 100;

    this.results.push(results);
    return results;
  }

  // Measure memory usage during operation
  async measureMemoryUsage(name, operation) {
    if (!performance.memory) {
      console.warn('Performance.memory not available');
      return { name, error: 'Memory measurement not supported' };
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    const memoryBefore = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    };

    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();

    // Force garbage collection again
    if (window.gc) {
      window.gc();
    }

    const memoryAfter = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    };

    const memoryResult = {
      name,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter.used - memoryBefore.used,
      result,
      timestamp: Date.now()
    };

    this.results.push(memoryResult);
    return memoryResult;
  }

  // Test scroll performance
  async testScrollPerformance(element, options = {}) {
    const {
      distance = 1000,
      steps = 10,
      smooth = false,
      duration = 1000
    } = options;

    const stepDistance = distance / steps;
    const stepDuration = duration / steps;
    const frameTimes = [];
    let frameCount = 0;

    return new Promise((resolve) => {
      const startTime = performance.now();
      let currentStep = 0;
      let lastFrameTime = startTime;

      const measureFrame = (currentTime) => {
        frameCount++;
        frameTimes.push(currentTime - lastFrameTime);
        lastFrameTime = currentTime;

        if (currentStep < steps) {
          const targetScroll = element.scrollTop + stepDistance;
          
          if (smooth) {
            element.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
          } else {
            element.scrollTop = targetScroll;
          }

          currentStep++;
          
          setTimeout(() => {
            requestAnimationFrame(measureFrame);
          }, stepDuration);
        } else {
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          
          // Calculate performance metrics
          const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
          const framesPerSecond = 1000 / averageFrameTime;
          
          // Calculate smoothness (lower is better)
          const frameTimeVariance = this.calculateVariance(frameTimes);
          const smoothness = 100 - Math.min(frameTimeVariance / 100, 100);

          const result = {
            totalDistance: distance,
            steps,
            totalTime,
            averageStepTime: totalTime / steps,
            frameCount,
            averageFrameTime,
            framesPerSecond,
            smoothness,
            frameTimes
          };

          this.results.push(result);
          resolve(result);
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  // Measure component render time
  async measureRenderTime(componentName, renderFunction, props = {}) {
    const startTime = performance.now();
    
    performance.mark(`${componentName}-render-start`);
    
    let result;
    try {
      result = await renderFunction(props);
    } catch (error) {
      performance.mark(`${componentName}-render-error`);
      throw error;
    }
    
    const endTime = performance.now();
    performance.mark(`${componentName}-render-end`);
    performance.measure(
      `${componentName}-render`,
      `${componentName}-render-start`,
      `${componentName}-render-end`
    );

    const renderResult = {
      componentName,
      renderTime: endTime - startTime,
      props,
      result,
      timestamp: Date.now()
    };

    this.results.push(renderResult);
    return renderResult;
  }

  // Test performance with large datasets
  async testLargeDatasetPerformance(processFunction, options = {}) {
    const {
      dataSize = 1000,
      iterations = 5,
      generateData = this.generateTestData
    } = options;

    const testData = generateData(dataSize);
    const processingTimes = [];
    const memoryUsages = [];

    for (let i = 0; i < iterations; i++) {
      const memoryResult = await this.measureMemoryUsage(
        `dataset-processing-${i}`,
        () => processFunction(testData)
      );
      
      processingTimes.push(memoryResult.duration);
      memoryUsages.push(memoryResult.memoryDelta);
    }

    const result = {
      dataSize,
      iterations,
      averageProcessingTime: processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length,
      minProcessingTime: Math.min(...processingTimes),
      maxProcessingTime: Math.max(...processingTimes),
      throughput: dataSize / (processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / 1000), // items per second
      memoryUsage: {
        averageDelta: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
        maxDelta: Math.max(...memoryUsages),
        minDelta: Math.min(...memoryUsages)
      },
      processingTimes,
      memoryUsages
    };

    this.results.push(result);
    return result;
  }

  // Generate test data
  generateTestData(size) {
    return Array.from({ length: size }, (_, index) => ({
      id: `item-${index}`,
      name: `Test Item ${index}`,
      value: Math.random() * 1000,
      timestamp: Date.now() + index,
      data: {
        nested: {
          property: `nested-value-${index}`,
          array: Array.from({ length: 10 }, (_, i) => `array-item-${i}`)
        }
      }
    }));
  }

  // Run single operation with timeout
  async runSingleOperation(operation, timeout) {
    const startTime = performance.now();
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('Operation timeout');
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      const endTime = performance.now();
      
      return {
        result,
        duration: endTime - startTime,
        success: true
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        error: error.message,
        duration: endTime - startTime,
        success: false
      };
    }
  }

  // Utility functions
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Generate performance report
  generatePerformanceReport(customResults = null) {
    const results = customResults || this.results;
    
    const report = {
      summary: {
        totalTests: results.length,
        timestamp: Date.now(),
        testDuration: this.getTestDuration(),
        systemInfo: this.getSystemInfo()
      },
      tests: results,
      recommendations: this.generateRecommendations(results),
      charts: this.generateChartData(results)
    };

    // Calculate summary statistics
    const performanceTests = results.filter(r => r.averageDuration !== undefined);
    if (performanceTests.length > 0) {
      report.summary.averageDuration = performanceTests.reduce((sum, test) => sum + test.averageDuration, 0) / performanceTests.length;
      report.summary.slowestTest = performanceTests.reduce((slowest, test) => 
        test.averageDuration > (slowest?.averageDuration || 0) ? test : slowest
      );
    }

    const memoryTests = results.filter(r => r.memoryDelta !== undefined);
    if (memoryTests.length > 0) {
      report.summary.totalMemoryDelta = memoryTests.reduce((sum, test) => sum + test.memoryDelta, 0);
      report.summary.largestMemoryIncrease = Math.max(...memoryTests.map(t => t.memoryDelta));
    }

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    // Performance recommendations
    results.forEach(result => {
      if (result.averageDuration > 1000) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          message: `${result.name} took ${result.averageDuration.toFixed(2)}ms, consider optimization`,
          suggestion: 'Consider code splitting, lazy loading, or algorithm optimization'
        });
      } else if (result.averageDuration > 500) {
        recommendations.push({
          type: 'performance',
          severity: 'medium',
          message: `${result.name} took ${result.averageDuration.toFixed(2)}ms, could be optimized`,
          suggestion: 'Review implementation for potential improvements'
        });
      }

      // Memory recommendations
      if (result.memoryDelta > 10 * 1024 * 1024) { // 10MB
        recommendations.push({
          type: 'memory',
          severity: 'high',
          message: `${result.name} used ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB of memory`,
          suggestion: 'Check for memory leaks, optimize data structures, or implement cleanup'
        });
      }

      // Load test recommendations
      if (result.errorRate > 5) {
        recommendations.push({
          type: 'reliability',
          severity: 'high',
          message: `${result.name} has ${result.errorRate.toFixed(2)}% error rate`,
          suggestion: 'Investigate and fix errors, add retry logic, or improve error handling'
        });
      }

      if (result.operationsPerSecond < 10) {
        recommendations.push({
          type: 'throughput',
          severity: 'medium',
          message: `${result.name} processes only ${result.operationsPerSecond.toFixed(2)} operations per second`,
          suggestion: 'Consider performance optimization or scaling strategies'
        });
      }
    });

    return recommendations;
  }

  generateChartData(results) {
    return {
      performanceTimeline: results
        .filter(r => r.timestamp && r.averageDuration)
        .map(r => ({
          timestamp: r.timestamp,
          duration: r.averageDuration,
          name: r.name
        })),
      memoryUsage: results
        .filter(r => r.memoryDelta !== undefined)
        .map(r => ({
          name: r.name,
          memoryDelta: r.memoryDelta,
          timestamp: r.timestamp
        })),
      loadTestResults: results
        .filter(r => r.operationsPerSecond !== undefined)
        .map(r => ({
          name: r.name,
          opsPerSecond: r.operationsPerSecond,
          errorRate: r.errorRate,
          averageResponseTime: r.averageResponseTime
        }))
    };
  }

  getTestDuration() {
    if (this.results.length === 0) return 0;
    
    const timestamps = this.results.map(r => r.timestamp).filter(Boolean);
    if (timestamps.length === 0) return 0;
    
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  getSystemInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      timing: performance.timing ? {
        navigationStart: performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      } : null,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };
  }

  // Clear results
  clearResults() {
    this.results = [];
  }

  // Export results
  exportResults(format = 'json') {
    const report = this.generatePerformanceReport();
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.convertToCSV(report.tests);
      default:
        return report;
    }
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
}

// Create singleton instance
const performanceTester = new PerformanceTester();

// Export utility functions
export const measurePerformance = (name, fn, options) => performanceTester.measurePerformance(name, fn, options);
export const runLoadTest = (operation, options) => performanceTester.runLoadTest(operation, options);
export const measureMemoryUsage = (name, operation) => performanceTester.measureMemoryUsage(name, operation);
export const testScrollPerformance = (element, options) => performanceTester.testScrollPerformance(element, options);
export const measureRenderTime = (componentName, renderFunction, props) => performanceTester.measureRenderTime(componentName, renderFunction, props);
export const testLargeDatasetPerformance = (processFunction, options) => performanceTester.testLargeDatasetPerformance(processFunction, options);
export const generatePerformanceReport = (customResults) => performanceTester.generatePerformanceReport(customResults);

export default performanceTester;
