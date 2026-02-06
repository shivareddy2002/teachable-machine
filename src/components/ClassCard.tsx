import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Trash2, Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebcam } from '@/hooks/useWebcam';
import type { ImageClass } from '@/types/teachable';

interface ClassCardProps {
  imageClass: ImageClass;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddSample: (dataUrl: string, canvas: HTMLCanvasElement) => Promise<void>;
  onRemoveSample: (sampleId: string) => void;
  canDelete: boolean;
}

export function ClassCard({
  imageClass,
  onRename,
  onDelete,
  onAddSample,
  onRemoveSample,
  canDelete,
}: ClassCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(imageClass.name);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isHoldCapture, setIsHoldCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureIntervalRef = useRef<number | null>(null);
  
  const { videoRef, isActive, error: webcamError, startWebcam, stopWebcam, captureFrame } = useWebcam();

  const handleRename = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const img = new Image();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      await new Promise<void>((resolve) => {
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Center crop
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            ctx.drawImage(img, x, y, size, size, 0, 0, 224, 224);
            await onAddSample(canvas.toDataURL('image/jpeg', 0.8), canvas);
          }
          resolve();
        };
        img.src = dataUrl;
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartCapture = async () => {
    if (!isActive) {
      await startWebcam();
    }
    setIsCapturing(true);
  };

  const handleStopCapture = () => {
    setIsCapturing(false);
    stopWebcam();
  };

  const captureImage = useCallback(async () => {
    const canvas = captureFrame();
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      await onAddSample(dataUrl, canvas);
    }
  }, [captureFrame, onAddSample]);

  const handleHoldStart = () => {
    setIsHoldCapture(true);
    captureImage();
    captureIntervalRef.current = window.setInterval(() => {
      captureImage();
    }, 150); // Capture ~6 images per second
  };

  const handleHoldEnd = () => {
    setIsHoldCapture(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 fade-in hover-lift">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: imageClass.color }}
          />
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 w-40"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRename}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-medium font-display">{imageClass.name}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setEditName(imageClass.name);
                  setIsEditing(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {imageClass.samples.length} samples
          </span>
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Webcam / Capture area */}
      {isCapturing && (
        <div className="mb-4">
          <div className="webcam-container bg-muted rounded-lg overflow-hidden mb-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {webcamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm p-4 text-center">
                {webcamError}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant={isHoldCapture ? 'default' : 'secondary'}
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
              disabled={!isActive}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isHoldCapture ? 'Capturing...' : 'Hold to Record'}
            </Button>
            <Button variant="outline" onClick={handleStopCapture}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isCapturing && (
        <div className="flex gap-2 mb-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleStartCapture}
          >
            <Camera className="h-4 w-4 mr-2" />
            Webcam
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      {/* Image thumbnails */}
      {imageClass.samples.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {imageClass.samples.map((sample) => (
            <div key={sample.id} className="relative group">
              <img
                src={sample.dataUrl}
                alt="Sample"
                className="image-thumbnail"
              />
              <button
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemoveSample(sample.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
