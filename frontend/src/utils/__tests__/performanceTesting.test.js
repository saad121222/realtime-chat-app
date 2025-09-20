import { 
  measurePerformance, 
  runLoadTest, 
  measureMemoryUsage, 
  testScrollPerformance,
  measureRenderTime,
  testLargeDatasetPerformance,
  generatePerformanceReport
} from '../performanceTesting';

// Mock performance APIs
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
  timing: {
    navigationStart: Date.now() - 1000,
    domContentLoadedEventEnd: Date.now() - 500,
    loadEventEnd: Date.now(),
  }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));

describe('Performance Testing Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performance.now.mockReturnValue(Date.now());
  });

  describe('measurePerformance', () => {
    it('should measure function execution time', async () => {
      const testFunction = jest.fn().mockResolvedValue('result');
      performance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1050); // End time

      const result = await measurePerformance('test-operation', testFunction);

      expect(result).toEqual({
        name: 'test-operation',
        duration: 50,
        result: 'result',
        timestamp: expect.any(Number)
      });
      expect(testFunction).toHaveBeenCalled();
    });

    it('should handle synchronous functions', () => {
      const testFunction = jest.fn().mockReturnValue('sync-result');
      performance.now
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(2025);

      const result = measurePerformance('sync-test', testFunction);

      expect(result).toEqual({
        name: 'sync-test',
        duration: 25,
        result: 'sync-result',
        timestamp: expect.any(Number)
      });
    });

    it('should handle function errors', async () => {
      const errorFunction = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(measurePerformance('error-test', errorFunction)).rejects.toThrow('Test error');
    });

    it('should create performance marks', async () => {
      const testFunction = jest.fn().mockResolvedValue('result');
      
      await measurePerformance('marked-operation', testFunction);

      expect(performance.mark).toHaveBeenCalledWith('marked-operation-start');
      expect(performance.mark).toHaveBeenCalledWith('marked-operation-end');
      expect(performance.measure).toHaveBeenCalledWith(
        'marked-operation',
        'marked-operation-start',
        'marked-operation-end'
      );
    });
  });

  describe('runLoadTest', () => {
    it('should run concurrent operations and measure performance', async () => {
      const testOperation = jest.fn().mockResolvedValue('success');
      const concurrency = 10;
      const iterations = 5;

      const results = await runLoadTest(testOperation, { concurrency, iterations });

      expect(testOperation).toHaveBeenCalledTimes(concurrency * iterations);
      expect(results).toEqual({
        totalOperations: concurrency * iterations,
        successfulOperations: concurrency * iterations,
        failedOperations: 0,
        averageResponseTime: expect.any(Number),
        minResponseTime: expect.any(Number),
        maxResponseTime: expect.any(Number),
        operationsPerSecond: expect.any(Number),
        errors: []
      });
    });

    it('should handle failed operations', async () => {
      const testOperation = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockResolvedValueOnce('success');

      const results = await runLoadTest(testOperation, { concurrency: 1, iterations: 3 });

      expect(results.successfulOperations).toBe(2);
      expect(results.failedOperations).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain('Operation failed');
    });

    it('should calculate performance metrics correctly', async () => {
      const testOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 100))
      );

      const results = await runLoadTest(testOperation, { concurrency: 2, iterations: 2 });

      expect(results.averageResponseTime).toBeGreaterThan(90);
      expect(results.minResponseTime).toBeGreaterThan(90);
      expect(results.maxResponseTime).toBeGreaterThan(90);
      expect(results.operationsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('measureMemoryUsage', () => {
    it('should measure memory usage before and after operation', async () => {
      const testOperation = jest.fn().mockResolvedValue('result');
      
      // Mock different memory values
      performance.memory.usedJSHeapSize = 1000000; // Before
      
      const result = await measureMemoryUsage('memory-test', testOperation);

      expect(result).toEqual({
        name: 'memory-test',
        memoryBefore: 1000000,
        memoryAfter: 1000000,
        memoryDelta: 0,
        result: 'result'
      });
    });

    it('should detect memory leaks', async () => {
      const leakyOperation = jest.fn().mockImplementation(() => {
        // Simulate memory increase
        performance.memory.usedJSHeapSize += 500000;
        return 'result';
      });

      const initialMemory = performance.memory.usedJSHeapSize;
      
      const result = await measureMemoryUsage('leak-test', leakyOperation);

      expect(result.memoryDelta).toBe(500000);
      expect(result.memoryAfter).toBe(initialMemory + 500000);
    });

    it('should handle operations that reduce memory usage', async () => {
      const cleanupOperation = jest.fn().mockImplementation(() => {
        // Simulate memory cleanup
        performance.memory.usedJSHeapSize -= 200000;
        return 'cleaned';
      });

      const result = await measureMemoryUsage('cleanup-test', cleanupOperation);

      expect(result.memoryDelta).toBe(-200000);
    });
  });

  describe('testScrollPerformance', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        scrollTop: 0,
        scrollHeight: 10000,
        clientHeight: 500,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        scrollTo: jest.fn()
      };
    });

    it('should measure scroll performance', async () => {
      const result = await testScrollPerformance(mockElement, { distance: 1000, steps: 10 });

      expect(result).toEqual({
        totalDistance: 1000,
        steps: 10,
        totalTime: expect.any(Number),
        averageStepTime: expect.any(Number),
        framesPerSecond: expect.any(Number),
        smoothness: expect.any(Number)
      });
    });

    it('should handle smooth scrolling', async () => {
      const result = await testScrollPerformance(mockElement, { 
        distance: 500, 
        steps: 5, 
        smooth: true 
      });

      expect(mockElement.scrollTo).toHaveBeenCalled();
      expect(result.smoothness).toBeGreaterThan(0);
    });

    it('should measure frame rate during scrolling', async () => {
      let frameCount = 0;
      global.requestAnimationFrame = jest.fn(cb => {
        frameCount++;
        setTimeout(cb, 16); // 60 FPS
        return frameCount;
      });

      const result = await testScrollPerformance(mockElement, { distance: 100, steps: 5 });

      expect(result.framesPerSecond).toBeCloseTo(60, 0);
    });
  });

  describe('measureRenderTime', () => {
    it('should measure component render time', async () => {
      const renderFunction = jest.fn().mockImplementation(() => {
        // Simulate render work
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait to simulate render time
        }
        return '<div>Rendered Component</div>';
      });

      const result = await measureRenderTime('test-component', renderFunction);

      expect(result).toEqual({
        componentName: 'test-component',
        renderTime: expect.any(Number),
        result: '<div>Rendered Component</div>',
        timestamp: expect.any(Number)
      });
      expect(result.renderTime).toBeGreaterThan(40);
    });

    it('should handle render errors', async () => {
      const errorRender = jest.fn().mockImplementation(() => {
        throw new Error('Render failed');
      });

      await expect(measureRenderTime('error-component', errorRender)).rejects.toThrow('Render failed');
    });
  });

  describe('testLargeDatasetPerformance', () => {
    it('should test performance with large datasets', async () => {
      const processFunction = jest.fn().mockImplementation((data) => {
        return data.map(item => ({ ...item, processed: true }));
      });

      const result = await testLargeDatasetPerformance(processFunction, {
        dataSize: 1000,
        iterations: 3
      });

      expect(result).toEqual({
        dataSize: 1000,
        iterations: 3,
        averageProcessingTime: expect.any(Number),
        minProcessingTime: expect.any(Number),
        maxProcessingTime: expect.any(Number),
        throughput: expect.any(Number),
        memoryUsage: expect.any(Object)
      });
    });

    it('should generate test data of specified size', async () => {
      const processFunction = jest.fn().mockImplementation((data) => data.length);

      await testLargeDatasetPerformance(processFunction, { dataSize: 500 });

      expect(processFunction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            value: expect.any(Number)
          })
        ])
      );
      
      const callArgs = processFunction.mock.calls[0][0];
      expect(callArgs).toHaveLength(500);
    });

    it('should measure memory usage during processing', async () => {
      const memoryIntensiveFunction = jest.fn().mockImplementation((data) => {
        // Simulate memory usage increase
        performance.memory.usedJSHeapSize += data.length * 100;
        return data;
      });

      const result = await testLargeDatasetPerformance(memoryIntensiveFunction, {
        dataSize: 100,
        iterations: 1
      });

      expect(result.memoryUsage.memoryDelta).toBeGreaterThan(0);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      const testResults = [
        {
          name: 'test-1',
          duration: 100,
          timestamp: Date.now()
        },
        {
          name: 'test-2',
          duration: 200,
          timestamp: Date.now()
        },
        {
          name: 'memory-test',
          memoryDelta: 1000000,
          memoryBefore: 2000000,
          memoryAfter: 3000000
        }
      ];

      const report = generatePerformanceReport(testResults);

      expect(report).toEqual({
        summary: {
          totalTests: 3,
          averageDuration: 150,
          totalMemoryDelta: 1000000,
          timestamp: expect.any(Number)
        },
        tests: testResults,
        recommendations: expect.any(Array),
        systemInfo: {
          userAgent: expect.any(String),
          memory: expect.any(Object),
          timing: expect.any(Object)
        }
      });
    });

    it('should provide performance recommendations', () => {
      const slowTestResults = [
        { name: 'slow-test', duration: 2000 },
        { name: 'memory-leak', memoryDelta: 10000000 }
      ];

      const report = generatePerformanceReport(slowTestResults);

      expect(report.recommendations).toContain(
        expect.stringContaining('slow-test took 2000ms')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('memory-leak used 10MB')
      );
    });

    it('should handle empty test results', () => {
      const report = generatePerformanceReport([]);

      expect(report.summary.totalTests).toBe(0);
      expect(report.summary.averageDuration).toBe(0);
      expect(report.tests).toEqual([]);
    });
  });

  describe('Integration Tests', () => {
    it('should run complete performance test suite', async () => {
      const testSuite = async () => {
        const results = [];
        
        // Test function performance
        const funcResult = await measurePerformance('test-function', () => {
          return Array.from({ length: 1000 }, (_, i) => i * 2);
        });
        results.push(funcResult);

        // Test memory usage
        const memResult = await measureMemoryUsage('memory-test', () => {
          return new Array(10000).fill('test');
        });
        results.push(memResult);

        // Test load performance
        const loadResult = await runLoadTest(() => Promise.resolve('ok'), {
          concurrency: 5,
          iterations: 10
        });
        results.push(loadResult);

        return results;
      };

      const results = await testSuite();
      const report = generatePerformanceReport(results);

      expect(results).toHaveLength(3);
      expect(report.summary.totalTests).toBe(3);
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });
});
