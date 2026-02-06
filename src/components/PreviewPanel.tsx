import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebcam } from '@/hooks/useWebcam';
import type { PredictionResult } from '@/types/teachable';

interface PreviewPanelProps {
  predictions: PredictionResult[];
  isTrained: boolean;
  onPredict: (video: HTMLVideoElement) => Promise<void>;
  onExport: () => Promise<void>;
}

export function PreviewPanel({
  predictions,
  isTrained,
  onPredict,
  onExport,
}: PreviewPanelProps) {
  const { videoRef, isActive, isLoading, error, startWebcam, stopWebcam } = useWebcam();
  const [isPredicting, setIsPredicting] = useState(false);
  const animationRef = useRef<number | null>(null);

  const runPrediction = useCallback(async () => {
    if (!videoRef.current || !isActive || !isTrained) return;

    try {
      await onPredict(videoRef.current);
    } catch (err) {
      console.error('Prediction error:', err);
    }

    animationRef.current = requestAnimationFrame(runPrediction);
  }, [videoRef, isActive, isTrained, onPredict]);

  useEffect(() => {
    if (isActive && isTrained && isPredicting) {
      animationRef.current = requestAnimationFrame(runPrediction);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isTrained, isPredicting, runPrediction]);

  const handleTogglePreview = async () => {
    if (isActive) {
      stopWebcam();
      setIsPredicting(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      await startWebcam();
      setIsPredicting(true);
    }
  };

  const topPrediction = predictions[0];

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-medium">Preview</h2>
        {isTrained && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Model
          </Button>
        )}
      </div>

      {/* Webcam preview */}
      <div className="webcam-container bg-muted rounded-lg overflow-hidden mb-4 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
            <span className="text-sm text-muted-foreground">Starting camera...</span>
          </div>
        )}
        
        {!isActive && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <CameraOff className="h-12 w-12 mb-2 opacity-50" />
            <span className="text-sm">Camera is off</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-destructive text-sm p-4 text-center">
            {error}
          </div>
        )}

        {/* Top prediction overlay */}
        {isActive && isTrained && topPrediction && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center justify-between text-white">
              <span className="font-medium">{topPrediction.className}</span>
              <span className="text-lg font-bold">
                {(topPrediction.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <Button
        className="w-full mb-4"
        variant={isActive ? 'secondary' : 'default'}
        onClick={handleTogglePreview}
        disabled={!isTrained || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting...
          </>
        ) : isActive ? (
          <>
            <CameraOff className="h-4 w-4 mr-2" />
            Stop Preview
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            Start Preview
          </>
        )}
      </Button>

      {!isTrained && (
        <p className="text-sm text-muted-foreground text-center mb-4">
          Train your model first to see live predictions
        </p>
      )}

      {/* Prediction bars */}
      {isTrained && predictions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Output
          </h3>
          {predictions.map((prediction) => (
            <div key={prediction.classId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: prediction.color }}
                  />
                  <span>{prediction.className}</span>
                </div>
                <span className="font-medium">
                  {(prediction.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="prediction-bar h-full"
                  style={{
                    width: `${prediction.confidence * 100}%`,
                    backgroundColor: prediction.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
