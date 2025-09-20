import React, { useState, useRef, useEffect, useCallback } from 'react';

const INTERSECTION_OPTIONS = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1
};

const IMAGE_CACHE = new Map();
const PRELOAD_CACHE = new Set();

export default function LazyImage({
  src,
  alt = '',
  className = '',
  placeholder,
  fallback,
  width,
  height,
  style = {},
  onClick,
  onLoad,
  onError,
  preload = false,
  blur = true,
  progressive = true,
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [lowQualitySrc, setLowQualitySrc] = useState(null);
  
  const imgRef = useRef(null);
  const observerRef = useRef(null);
  const loadTimeoutRef = useRef(null);

  // Generate low quality placeholder if progressive loading is enabled
  const generateLowQualityPlaceholder = useCallback((originalSrc) => {
    if (!progressive || !originalSrc) return null;
    
    // For demo purposes, we'll use a simple blur filter
    // In production, you might generate actual low-quality versions
    return originalSrc + '?w=50&q=10'; // Assuming your backend supports query params
  }, [progressive]);

  // Preload image in cache
  const preloadImage = useCallback((src) => {
    if (!src || IMAGE_CACHE.has(src) || PRELOAD_CACHE.has(src)) return;
    
    PRELOAD_CACHE.add(src);
    const img = new Image();
    
    img.onload = () => {
      IMAGE_CACHE.set(src, img);
      PRELOAD_CACHE.delete(src);
    };
    
    img.onerror = () => {
      PRELOAD_CACHE.delete(src);
    };
    
    img.src = src;
  }, []);

  // Load image with caching
  const loadImage = useCallback(async (src) => {
    if (!src) return null;
    
    // Check cache first
    if (IMAGE_CACHE.has(src)) {
      return IMAGE_CACHE.get(src);
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        IMAGE_CACHE.set(src, img);
        resolve(img);
      };
      
      img.onerror = (error) => {
        reject(error);
      };
      
      img.src = src;
    });
  }, []);

  // Handle image loading
  const handleImageLoad = useCallback(async () => {
    if (!src || isLoaded) return;
    
    try {
      // Load low quality version first if progressive
      if (progressive && !lowQualitySrc) {
        const lowQualityUrl = generateLowQualityPlaceholder(src);
        if (lowQualityUrl) {
          setLowQualitySrc(lowQualityUrl);
        }
      }
      
      // Load full quality image
      await loadImage(src);
      setImageSrc(src);
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
      
    } catch (error) {
      console.warn('Failed to load image:', src, error);
      setHasError(true);
      onError?.(error);
    }
  }, [src, isLoaded, progressive, lowQualitySrc, generateLowQualityPlaceholder, loadImage, onLoad, onError]);

  // Intersection Observer setup
  useEffect(() => {
    const currentRef = imgRef.current;
    if (!currentRef) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      INTERSECTION_OPTIONS
    );

    observerRef.current.observe(currentRef);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Load image when in view
  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      // Add small delay to prevent loading too many images at once
      loadTimeoutRef.current = setTimeout(handleImageLoad, 50);
    }
  }, [isInView, isLoaded, hasError, handleImageLoad]);

  // Preload if requested
  useEffect(() => {
    if (preload && src) {
      preloadImage(src);
    }
  }, [preload, src, preloadImage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Render placeholder while loading
  if (!isInView || (!isLoaded && !hasError)) {
    const placeholderContent = placeholder || (
      <div className="lazy-image-placeholder">
        <div className="placeholder-shimmer"></div>
        {width && height && (
          <div className="placeholder-icon">📷</div>
        )}
      </div>
    );

    return (
      <div
        ref={imgRef}
        className={`lazy-image-container ${className} loading`}
        style={{
          width,
          height,
          ...style
        }}
        {...props}
      >
        {placeholderContent}
      </div>
    );
  }

  // Render error fallback
  if (hasError) {
    const errorContent = fallback || (
      <div className="lazy-image-error">
        <div className="error-icon">❌</div>
        <div className="error-text">Failed to load image</div>
      </div>
    );

    return (
      <div
        ref={imgRef}
        className={`lazy-image-container ${className} error`}
        style={{
          width,
          height,
          ...style
        }}
        onClick={onClick}
        {...props}
      >
        {errorContent}
      </div>
    );
  }

  // Render loaded image
  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className} ${isLoaded ? 'loaded' : ''}`}
      style={{
        width,
        height,
        ...style
      }}
      onClick={onClick}
      {...props}
    >
      {/* Progressive loading: show low quality first */}
      {progressive && lowQualitySrc && !isLoaded && (
        <img
          src={lowQualitySrc}
          alt={alt}
          className={`lazy-image low-quality ${blur ? 'blur' : ''}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      )}
      
      {/* Main image */}
      <img
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${isLoaded ? 'fade-in' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0
        }}
        loading="lazy"
      />
    </div>
  );
}

// Specialized components for different use cases
export function LazyAvatar({ src, name, size = 40, ...props }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : '?';
  
  return (
    <LazyImage
      src={src}
      alt={name}
      width={size}
      height={size}
      className="lazy-avatar"
      style={{
        borderRadius: '50%',
        minWidth: size,
        minHeight: size
      }}
      placeholder={
        <div 
          className="avatar-placeholder"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#25d366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#07352e',
            fontWeight: '600',
            fontSize: size > 32 ? '14px' : '12px'
          }}
        >
          {initials}
        </div>
      }
      fallback={
        <div 
          className="avatar-fallback"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: size > 32 ? '14px' : '12px'
          }}
        >
          {initials}
        </div>
      }
      {...props}
    />
  );
}

export function LazyMediaImage({ src, thumbnail, width, height, ...props }) {
  return (
    <LazyImage
      src={src}
      width={width}
      height={height}
      className="lazy-media-image"
      progressive={true}
      blur={true}
      placeholder={
        <div className="media-placeholder">
          <div className="media-shimmer"></div>
          <div className="media-play-icon">▶️</div>
        </div>
      }
      fallback={
        <div className="media-error">
          <div className="media-error-icon">🖼️</div>
          <div className="media-error-text">Image unavailable</div>
        </div>
      }
      {...props}
    />
  );
}

// Utility function to clear image cache
export function clearImageCache() {
  IMAGE_CACHE.clear();
  PRELOAD_CACHE.clear();
}

// Utility function to preload multiple images
export function preloadImages(urls) {
  urls.forEach(url => {
    if (!IMAGE_CACHE.has(url) && !PRELOAD_CACHE.has(url)) {
      PRELOAD_CACHE.add(url);
      const img = new Image();
      img.onload = () => {
        IMAGE_CACHE.set(url, img);
        PRELOAD_CACHE.delete(url);
      };
      img.onerror = () => {
        PRELOAD_CACHE.delete(url);
      };
      img.src = url;
    }
  });
}
