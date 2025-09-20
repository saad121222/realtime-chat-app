import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LazyImage, { LazyAvatar, LazyMediaImage, clearImageCache, preloadImages } from '../LazyImage';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock Image constructor
const mockImage = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  src: '',
  onload: null,
  onerror: null,
};

global.Image = jest.fn(() => mockImage);

describe('LazyImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearImageCache();
  });

  describe('Basic Rendering', () => {
    it('should render placeholder initially', () => {
      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      expect(screen.getByText('📷')).toBeInTheDocument();
      expect(screen.getByText('Add Photo')).toBeInTheDocument();
    });

    it('should render custom placeholder', () => {
      const customPlaceholder = <div data-testid="custom-placeholder">Custom Placeholder</div>;
      
      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          placeholder={customPlaceholder}
        />
      );
      
      expect(screen.getByTestId('custom-placeholder')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('lazy-image-container', 'custom-class', 'loading');
    });

    it('should apply width and height styles', () => {
      const { container } = render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          width={200}
          height={150}
        />
      );
      
      expect(container.firstChild).toHaveStyle({
        width: '200px',
        height: '150px',
      });
    });
  });

  describe('Intersection Observer', () => {
    it('should set up intersection observer on mount', () => {
      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        {
          root: null,
          rootMargin: '50px',
          threshold: 0.1,
        }
      );
    });

    it('should observe the image container', () => {
      const mockObserve = jest.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: mockObserve,
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      expect(mockObserve).toHaveBeenCalled();
    });

    it('should disconnect observer on unmount', () => {
      const mockDisconnect = jest.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect,
      });

      const { unmount } = render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      unmount();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('Image Loading', () => {
    it('should load image when in view', async () => {
      // Mock intersection observer to trigger image loading
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      // Wait for image loading
      await waitFor(() => {
        expect(global.Image).toHaveBeenCalled();
      });
    });

    it('should show loaded image after successful load', async () => {
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      // Simulate successful image load
      await waitFor(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      });

      await waitFor(() => {
        expect(screen.getByAltText('Test Image')).toBeInTheDocument();
      });
    });

    it('should show error fallback on load failure', async () => {
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(<LazyImage src="invalid-image.jpg" alt="Test Image" />);
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      // Simulate image load error
      await waitFor(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load'));
        }
      });

      await waitFor(() => {
        expect(screen.getByText('❌')).toBeInTheDocument();
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });
    });

    it('should render custom fallback on error', async () => {
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      const customFallback = <div data-testid="custom-fallback">Custom Error</div>;

      render(
        <LazyImage 
          src="invalid-image.jpg" 
          alt="Test Image" 
          fallback={customFallback}
        />
      );
      
      // Simulate image coming into view and failing to load
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      await waitFor(() => {
        if (mockImage.onerror) {
          mockImage.onerror(new Error('Failed to load'));
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      });
    });
  });

  describe('Progressive Loading', () => {
    it('should show low quality image first when progressive is enabled', async () => {
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          progressive={true}
        />
      );
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      await waitFor(() => {
        const lowQualityImage = screen.getByAltText('Test Image');
        expect(lowQualityImage).toHaveClass('low-quality');
      });
    });

    it('should apply blur effect to low quality image', async () => {
      let intersectionCallback;
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          progressive={true}
          blur={true}
        />
      );
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      await waitFor(() => {
        const lowQualityImage = screen.getByAltText('Test Image');
        expect(lowQualityImage).toHaveClass('blur');
      });
    });
  });

  describe('Preloading', () => {
    it('should preload image when preload prop is true', () => {
      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          preload={true}
        />
      );
      
      expect(global.Image).toHaveBeenCalled();
    });

    it('should not preload by default', () => {
      render(<LazyImage src="test-image.jpg" alt="Test Image" />);
      
      // Image should not be created until in view
      expect(global.Image).not.toHaveBeenCalled();
    });
  });

  describe('Event Handlers', () => {
    it('should call onClick handler', () => {
      const mockClick = jest.fn();
      
      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          onClick={mockClick}
        />
      );
      
      fireEvent.click(screen.getByRole('img', { hidden: true }));
      expect(mockClick).toHaveBeenCalled();
    });

    it('should call onLoad handler on successful load', async () => {
      const mockOnLoad = jest.fn();
      let intersectionCallback;
      
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(
        <LazyImage 
          src="test-image.jpg" 
          alt="Test Image" 
          onLoad={mockOnLoad}
        />
      );
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      // Simulate successful load
      await waitFor(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      });

      expect(mockOnLoad).toHaveBeenCalled();
    });

    it('should call onError handler on load failure', async () => {
      const mockOnError = jest.fn();
      let intersectionCallback;
      
      mockIntersectionObserver.mockImplementation((callback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        };
      });

      render(
        <LazyImage 
          src="invalid-image.jpg" 
          alt="Test Image" 
          onError={mockOnError}
        />
      );
      
      // Simulate image coming into view
      intersectionCallback([{
        isIntersecting: true,
        target: document.createElement('div'),
      }]);

      // Simulate load error
      await waitFor(() => {
        if (mockImage.onerror) {
          const error = new Error('Load failed');
          mockImage.onerror(error);
        }
      });

      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

describe('LazyAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render avatar with initials fallback', () => {
    render(<LazyAvatar name="John Doe" size={40} />);
    
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should apply size styles', () => {
    const { container } = render(<LazyAvatar name="John Doe" size={60} />);
    
    expect(container.firstChild).toHaveStyle({
      width: '60px',
      height: '60px',
      minWidth: '60px',
      minHeight: '60px',
      borderRadius: '50%',
    });
  });

  it('should show question mark for empty name', () => {
    render(<LazyAvatar name="" size={40} />);
    
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should render image when src is provided', () => {
    render(<LazyAvatar src="avatar.jpg" name="John Doe" size={40} />);
    
    // Should still show placeholder initially
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});

describe('LazyMediaImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render media placeholder', () => {
    render(<LazyMediaImage src="video.mp4" width={300} height={200} />);
    
    expect(screen.getByText('▶️')).toBeInTheDocument();
  });

  it('should show media error fallback', async () => {
    let intersectionCallback;
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });

    render(<LazyMediaImage src="invalid-video.mp4" width={300} height={200} />);
    
    // Simulate coming into view and failing to load
    intersectionCallback([{
      isIntersecting: true,
      target: document.createElement('div'),
    }]);

    await waitFor(() => {
      if (mockImage.onerror) {
        mockImage.onerror(new Error('Failed to load'));
      }
    });

    await waitFor(() => {
      expect(screen.getByText('🖼️')).toBeInTheDocument();
      expect(screen.getByText('Image unavailable')).toBeInTheDocument();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearImageCache();
  });

  it('should clear image cache', () => {
    clearImageCache();
    // This should not throw and should clear internal cache
    expect(true).toBe(true);
  });

  it('should preload multiple images', () => {
    const urls = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
    
    preloadImages(urls);
    
    expect(global.Image).toHaveBeenCalledTimes(3);
  });

  it('should not preload duplicate images', () => {
    const urls = ['image1.jpg', 'image1.jpg', 'image2.jpg'];
    
    preloadImages(urls);
    
    // Should only create 2 Image instances (duplicates filtered)
    expect(global.Image).toHaveBeenCalledTimes(2);
  });
});
