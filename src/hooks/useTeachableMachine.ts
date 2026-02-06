import { useState, useCallback, useEffect } from 'react';
import type { ImageClass, ImageSample, TrainingProgress, PredictionResult, ModelConfig } from '@/types/teachable';
import { getTeachableMachine } from '@/lib/teachable-machine';

const CLASS_COLORS = [
  'hsl(217, 91%, 60%)',   // Blue
  'hsl(142, 71%, 45%)',   // Green
  'hsl(38, 92%, 50%)',    // Orange
  'hsl(280, 68%, 60%)',   // Purple
  'hsl(339, 90%, 51%)',   // Pink
  'hsl(174, 83%, 40%)',   // Teal
];

const generateId = () => Math.random().toString(36).substring(2, 11);

interface UseTeachableMachineReturn {
  classes: ImageClass[];
  isModelReady: boolean;
  isTraining: boolean;
  isTrained: boolean;
  trainingProgress: TrainingProgress | null;
  predictions: PredictionResult[];
  error: string | null;
  
  addClass: () => void;
  removeClass: (id: string) => void;
  renameClass: (id: string, name: string) => void;
  addSample: (classId: string, dataUrl: string, canvas: HTMLCanvasElement) => Promise<void>;
  removeSample: (classId: string, sampleId: string) => void;
  
  train: (config: ModelConfig) => Promise<void>;
  predict: (video: HTMLVideoElement) => Promise<void>;
  exportModel: () => Promise<void>;
  
  canTrain: boolean;
}

export function useTeachableMachine(): UseTeachableMachineReturn {
  const [classes, setClasses] = useState<ImageClass[]>([
    { id: generateId(), name: 'Class 1', color: CLASS_COLORS[0], samples: [] },
    { id: generateId(), name: 'Class 2', color: CLASS_COLORS[1], samples: [] },
  ]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize the model on mount
  useEffect(() => {
    const init = async () => {
      try {
        const tm = getTeachableMachine();
        await tm.initialize();
        setIsModelReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize model';
        setError(message);
      }
    };
    init();
  }, []);

  const addClass = useCallback(() => {
    setClasses(prev => {
      const newIndex = prev.length;
      return [
        ...prev,
        {
          id: generateId(),
          name: `Class ${newIndex + 1}`,
          color: CLASS_COLORS[newIndex % CLASS_COLORS.length],
          samples: [],
        },
      ];
    });
  }, []);

  const removeClass = useCallback((id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  }, []);

  const renameClass = useCallback((id: string, name: string) => {
    setClasses(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
  }, []);

  const addSample = useCallback(async (classId: string, dataUrl: string, canvas: HTMLCanvasElement) => {
    try {
      const tm = getTeachableMachine();
      const features = await tm.extractFeatures(canvas);
      
      const sample: ImageSample = {
        id: generateId(),
        dataUrl,
        tensor: Array.from(features),
      };

      setClasses(prev =>
        prev.map(c =>
          c.id === classId
            ? { ...c, samples: [...c.samples, sample] }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to add sample:', err);
      setError('Failed to process image');
    }
  }, []);

  const removeSample = useCallback((classId: string, sampleId: string) => {
    setClasses(prev =>
      prev.map(c =>
        c.id === classId
          ? { ...c, samples: c.samples.filter(s => s.id !== sampleId) }
          : c
      )
    );
  }, []);

  const train = useCallback(async (config: ModelConfig) => {
    setError(null);
    setIsTraining(true);
    setIsTrained(false);

    try {
      const tm = getTeachableMachine();
      await tm.train(classes, config, setTrainingProgress);
      setIsTrained(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Training failed';
      setError(message);
      setTrainingProgress({
        epoch: 0,
        totalEpochs: config.epochs,
        loss: 0,
        accuracy: 0,
        status: 'error',
        message,
      });
    } finally {
      setIsTraining(false);
    }
  }, [classes]);

  const predict = useCallback(async (video: HTMLVideoElement) => {
    try {
      const tm = getTeachableMachine();
      const results = await tm.predict(video);
      setPredictions(results);
    } catch (err) {
      // Silently fail for predictions - they happen frequently
      console.error('Prediction failed:', err);
    }
  }, []);

  const exportModel = useCallback(async () => {
    try {
      const tm = getTeachableMachine();
      await tm.exportModel('tfjs');
      
      // Also export class metadata
      const metadata = tm.getClassMetadata();
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'teachable-machine-metadata.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
    }
  }, []);

  const canTrain = classes.filter(c => c.samples.length > 0).length >= 2;

  return {
    classes,
    isModelReady,
    isTraining,
    isTrained,
    trainingProgress,
    predictions,
    error,
    addClass,
    removeClass,
    renameClass,
    addSample,
    removeSample,
    train,
    predict,
    exportModel,
    canTrain,
  };
}
