// Types for Teachable Machine clone

export interface ImageSample {
  id: string;
  dataUrl: string;
  tensor?: number[]; // Flattened embedding from MobileNet
}

export interface ImageClass {
  id: string;
  name: string;
  color: string;
  samples: ImageSample[];
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
  status: 'idle' | 'preparing' | 'training' | 'complete' | 'error';
  message: string;
}

export interface PredictionResult {
  className: string;
  classId: string;
  confidence: number;
  color: string;
}

export interface ModelConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
}

export type ExportFormat = 'tfjs' | 'keras' | 'savedmodel';
