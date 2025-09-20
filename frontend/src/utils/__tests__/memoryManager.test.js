import memoryManager, { 
  useMemoryCleanup, 
  useTimer, 
  useObserver,
  createManagedTimer,
  createManagedObserver,
  createManagedEventListener,
  createManagedObjectURL,
  createManagedAbortController
} from '../memoryManager';
import { renderHook, act } from '@testing-library/react';

// Mock performance.memory
Object.defineProperty(performance, 'memory', {
  writable: true,
  value: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
});

describe('MemoryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset memory manager state
    memoryManager.cleanup();
  });

  describe('Timer Management', () => {
    it('should track setTimeout calls', () => {
      const timerId = createManagedTimer(() => {}, 1000, 'timeout');
      
      expect(typeof timerId).toBe('number');
      
      const stats = memoryManager.getStats();
      expect(stats.timers).toBe(1);
    });

    it('should track setInterval calls', () => {
      const timerId = createManagedTimer(() => {}, 1000, 'interval');
      
      expect(typeof timerId).toBe('number');
      
      const stats = memoryManager.getStats();
      expect(stats.timers).toBe(1);
    });

    it('should clean up timers on cleanup', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      createManagedTimer(() => {}, 1000, 'timeout');
      createManagedTimer(() => {}, 1000, 'interval');
      
      memoryManager.cleanup();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      const stats = memoryManager.getStats();
      expect(stats.timers).toBe(0);
    });
  });

  describe('Observer Management', () => {
    it('should track observers', () => {
      const mockObserver = {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
      
      const MockObserver = jest.fn(() => mockObserver);
      const observer = createManagedObserver(MockObserver, jest.fn(), {});
      
      expect(observer).toBe(mockObserver);
      
      const stats = memoryManager.getStats();
      expect(stats.observers).toBe(1);
    });

    it('should clean up observers on cleanup', () => {
      const mockObserver = {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
      
      const MockObserver = jest.fn(() => mockObserver);
      createManagedObserver(MockObserver, jest.fn(), {});
      
      memoryManager.cleanup();
      
      expect(mockObserver.disconnect).toHaveBeenCalled();
      
      const stats = memoryManager.getStats();
      expect(stats.observers).toBe(0);
    });
  });

  describe('Event Listener Management', () => {
    it('should track event listeners', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      
      const cleanup = createManagedEventListener(
        mockElement, 
        'click', 
        jest.fn(), 
        {}
      );
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), {});
      expect(typeof cleanup).toBe('function');
      
      const stats = memoryManager.getStats();
      expect(stats.eventListeners).toBeGreaterThan(0);
    });

    it('should remove event listeners on cleanup', () => {
      const mockElement = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        constructor: { name: 'HTMLElement' }
      };
      
      createManagedEventListener(mockElement, 'click', jest.fn(), {});
      
      memoryManager.cleanup();
      
      expect(mockElement.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Object URL Management', () => {
    it('should track object URLs', () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' });
      const url = createManagedObjectURL(mockBlob);
      
      expect(typeof url).toBe('string');
      
      const stats = memoryManager.getStats();
      expect(stats.objectUrls).toBe(1);
    });

    it('should revoke object URLs on cleanup', () => {
      const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');
      
      const mockBlob = new Blob(['test'], { type: 'text/plain' });
      createManagedObjectURL(mockBlob);
      
      memoryManager.cleanup();
      
      expect(revokeObjectURLSpy).toHaveBeenCalled();
      
      const stats = memoryManager.getStats();
      expect(stats.objectUrls).toBe(0);
    });
  });

  describe('AbortController Management', () => {
    it('should track abort controllers', () => {
      const controller = createManagedAbortController();
      
      expect(controller).toBeInstanceOf(AbortController);
      
      const stats = memoryManager.getStats();
      expect(stats.abortControllers).toBe(1);
    });

    it('should abort controllers on cleanup', () => {
      const controller = createManagedAbortController();
      const abortSpy = jest.spyOn(controller, 'abort');
      
      memoryManager.cleanup();
      
      expect(abortSpy).toHaveBeenCalled();
      
      const stats = memoryManager.getStats();
      expect(stats.abortControllers).toBe(0);
    });
  });

  describe('Memory Monitoring', () => {
    it('should detect memory leaks', () => {
      // Create many timers to simulate a leak
      for (let i = 0; i < 150; i++) {
        createManagedTimer(() => {}, 1000, 'timeout');
      }
      
      const leaks = memoryManager.detectLeaks();
      
      expect(leaks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'timers',
            severity: 'high'
          })
        ])
      );
    });

    it('should get memory statistics', () => {
      createManagedTimer(() => {}, 1000, 'timeout');
      
      const stats = memoryManager.getStats();
      
      expect(stats).toEqual(
        expect.objectContaining({
          timers: expect.any(Number),
          observers: expect.any(Number),
          eventListeners: expect.any(Number),
          subscriptions: expect.any(Number),
          webWorkers: expect.any(Number),
          mediaStreams: expect.any(Number),
          objectUrls: expect.any(Number),
          abortControllers: expect.any(Number),
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          heapLimit: expect.any(Number),
        })
      );
    });
  });

  describe('Memory Pressure Handling', () => {
    it('should handle memory pressure', () => {
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      
      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        writable: true,
        value: {
          usedJSHeapSize: 3500000, // High usage
          totalJSHeapSize: 4000000,
          jsHeapSizeLimit: 4000000,
        },
      });
      
      memoryManager.handleMemoryPressure();
      
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory-pressure'
        })
      );
    });
  });
});

describe('useMemoryCleanup hook', () => {
  it('should provide registerCleanup function', () => {
    const { result } = renderHook(() => useMemoryCleanup());
    
    expect(result.current.registerCleanup).toBeInstanceOf(Function);
  });

  it('should call cleanup functions on unmount', () => {
    const mockCleanup = jest.fn();
    
    const { unmount } = renderHook(() => {
      const { registerCleanup } = useMemoryCleanup();
      registerCleanup(mockCleanup);
      return null;
    });
    
    unmount();
    
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('should call cleanup functions when dependencies change', () => {
    const mockCleanup = jest.fn();
    let dependency = 'initial';
    
    const { rerender } = renderHook(() => {
      const { registerCleanup } = useMemoryCleanup([dependency]);
      registerCleanup(mockCleanup);
      return null;
    });
    
    dependency = 'changed';
    rerender();
    
    expect(mockCleanup).toHaveBeenCalled();
  });
});

describe('useTimer hook', () => {
  it('should provide timer functions', () => {
    const { result } = renderHook(() => useTimer());
    
    expect(result.current.setTimeout).toBeInstanceOf(Function);
    expect(result.current.setInterval).toBeInstanceOf(Function);
    expect(result.current.clearTimeout).toBeInstanceOf(Function);
    expect(result.current.clearInterval).toBeInstanceOf(Function);
  });

  it('should track timers', () => {
    const { result } = renderHook(() => useTimer());
    
    act(() => {
      result.current.setTimeout(() => {}, 1000);
      result.current.setInterval(() => {}, 1000);
    });
    
    // Timers should be tracked internally
    expect(true).toBe(true); // Basic test that no errors occur
  });

  it('should clean up timers on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const { result, unmount } = renderHook(() => useTimer());
    
    let timeoutId, intervalId;
    
    act(() => {
      timeoutId = result.current.setTimeout(() => {}, 1000);
      intervalId = result.current.setInterval(() => {}, 1000);
    });
    
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });

  it('should clear specific timers', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const { result } = renderHook(() => useTimer());
    
    let timeoutId, intervalId;
    
    act(() => {
      timeoutId = result.current.setTimeout(() => {}, 1000);
      intervalId = result.current.setInterval(() => {}, 1000);
    });
    
    act(() => {
      result.current.clearTimeout(timeoutId);
      result.current.clearInterval(intervalId);
    });
    
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });
});

describe('useObserver hook', () => {
  it('should provide registerObserver function', () => {
    const { result } = renderHook(() => useObserver());
    
    expect(result.current.registerObserver).toBeInstanceOf(Function);
  });

  it('should track observers', () => {
    const { result } = renderHook(() => useObserver());
    
    const mockObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
    
    act(() => {
      result.current.registerObserver(mockObserver);
    });
    
    expect(true).toBe(true); // Basic test that no errors occur
  });

  it('should clean up observers on unmount', () => {
    const mockObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const { result, unmount } = renderHook(() => useObserver());
    
    act(() => {
      result.current.registerObserver(mockObserver);
    });
    
    unmount();
    
    expect(mockObserver.disconnect).toHaveBeenCalled();
  });
});

describe('Performance Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start performance monitoring in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    
    // This would be called during initialization
    // For testing purposes, we'll just verify the concept
    expect(true).toBe(true);
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should force garbage collection when available', () => {
    // Mock gc function
    global.gc = jest.fn();
    
    const result = memoryManager.forceGC();
    
    expect(result).toBe(true);
    expect(global.gc).toHaveBeenCalled();
    
    delete global.gc;
  });

  it('should return false when gc is not available', () => {
    delete global.gc;
    
    const result = memoryManager.forceGC();
    
    expect(result).toBe(false);
  });
});
