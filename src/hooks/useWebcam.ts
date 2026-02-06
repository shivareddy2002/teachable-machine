import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  startWebcam: () => Promise<boolean>;
  stopWebcam: () => void;
  captureFrame: () => HTMLCanvasElement | null;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startWebcam = useCallback(async (): Promise<boolean> => {
    // Already active
    if (streamRef.current && isActive) {
      return true;
    }

    try {
      setError(null);
      setIsLoading(true);

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user',
        },
        audio: false,
      });

      // Ensure video element exists
      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video element not ready. Please try again.');
      }

      // Set the stream
      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const video = videoRef.current!;
        
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = (e: Event) => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Failed to load video stream'));
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video load timeout'));
        }, 10000);
      });

      // Play the video
      await videoRef.current.play();
      setIsActive(true);
      setIsLoading(false);
      return true;

    } catch (err) {
      setIsLoading(false);
      
      let message = 'Failed to access webcam';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission denied. Please allow camera access and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No camera found. Please connect a camera and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera is in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
          message = 'Camera does not meet requirements. Trying with default settings...';
          // Try with minimal constraints
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              streamRef.current = stream;
              await videoRef.current.play();
              setIsActive(true);
              setError(null);
              return true;
            }
          } catch {
            message = 'Failed to access camera with any settings.';
          }
        } else {
          message = err.message;
        }
      }
      
      setError(message);
      console.error('Webcam error:', err);
      return false;
    }
  }, [isActive]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setError(null);
  }, []);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    if (!videoRef.current || !isActive) {
      console.warn('Cannot capture frame: webcam not active');
      return null;
    }

    const video = videoRef.current;
    
    // Check if video is ready
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      console.warn('Video not ready for capture');
      return null;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video dimensions not available');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Could not get canvas context');
      return null;
    }

    // Calculate crop dimensions for center crop (to maintain aspect ratio)
    const size = Math.min(video.videoWidth, video.videoHeight);
    const x = (video.videoWidth - size) / 2;
    const y = (video.videoHeight - size) / 2;

    // Draw cropped and resized image
    ctx.drawImage(video, x, y, size, size, 0, 0, 224, 224);

    return canvas;
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    isActive,
    isLoading,
    error,
    startWebcam,
    stopWebcam,
    captureFrame,
  };
}
