import * as tf from '@tensorflow/tfjs';
import type { ImageClass, TrainingProgress, PredictionResult, ModelConfig } from '@/types/teachable';

const IMAGE_SIZE = 224;
const MOBILENET_LAYER = 'conv_pw_13_relu'; // Layer to extract features from

class TeachableMachine {
  private mobilenet: tf.LayersModel | null = null;
  private classifier: tf.Sequential | null = null;
  private classes: ImageClass[] = [];
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.isReady) return;

    try {
      // Load MobileNetV2 from TensorFlow Hub
      const mobilenetUrl = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1';
      
      // For better compatibility, use the standard MobileNet model
      const mobilenet = await tf.loadLayersModel(
        'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json'
      );

      // Get the feature extraction layer
      const layer = mobilenet.getLayer(MOBILENET_LAYER);
      this.mobilenet = tf.model({
        inputs: mobilenet.inputs,
        outputs: layer.output as tf.SymbolicTensor,
      });

      this.isReady = true;
      console.log('MobileNet loaded successfully');
    } catch (error) {
      console.error('Failed to load MobileNet:', error);
      throw new Error('Failed to initialize the machine learning model');
    }
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  // Preprocess image to tensor
  preprocessImage(imageData: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): tf.Tensor3D {
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(imageData);
      
      // Resize to 224x224
      tensor = tf.image.resizeBilinear(tensor as tf.Tensor3D, [IMAGE_SIZE, IMAGE_SIZE]);
      
      // Normalize to [-1, 1] as expected by MobileNet
      tensor = tensor.toFloat().div(127.5).sub(1);
      
      return tensor as tf.Tensor3D;
    });
  }

  // Extract features from an image using MobileNet
  async extractFeatures(imageData: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<Float32Array> {
    if (!this.mobilenet) {
      throw new Error('Model not initialized');
    }

    return tf.tidy(() => {
      const tensor = this.preprocessImage(imageData);
      const batched = tensor.expandDims(0);
      const features = this.mobilenet!.predict(batched) as tf.Tensor;
      return features.dataSync() as Float32Array;
    });
  }

  // Build the classifier head
  // NOTE: Input is already flattened 1D feature vectors from MobileNet, so we use Dense directly
  private buildClassifier(numClasses: number, featureSize: number): tf.Sequential {
    const model = tf.sequential();

    // Input is already 1D (flattened features from MobileNet's GlobalAveragePooling equivalent)
    // So we use Dense layers directly without Flatten
    model.add(tf.layers.dense({
      inputShape: [featureSize],
      units: 128,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({
      units: numClasses,
      activation: 'softmax',
    }));

    return model;
  }

  // Validate training data before training
  private validateTrainingData(classes: ImageClass[]): { 
    isValid: boolean; 
    error?: string; 
    validClasses: ImageClass[];
    totalSamples: number;
  } {
    const validClasses = classes.filter(c => c.samples.length > 0);
    
    if (validClasses.length < 2) {
      return { 
        isValid: false, 
        error: 'Need at least 2 classes with samples to train',
        validClasses: [],
        totalSamples: 0
      };
    }

    let totalSamples = 0;
    let validSamples = 0;

    for (const imageClass of validClasses) {
      for (const sample of imageClass.samples) {
        totalSamples++;
        if (sample.tensor && sample.tensor.length > 0) {
          validSamples++;
        }
      }
    }

    if (validSamples === 0) {
      return { 
        isValid: false, 
        error: 'No valid image samples found. Please re-capture images.',
        validClasses: [],
        totalSamples: 0
      };
    }

    if (validSamples < validClasses.length) {
      return { 
        isValid: false, 
        error: 'Each class needs at least one valid sample.',
        validClasses: [],
        totalSamples: 0
      };
    }

    return { isValid: true, validClasses, totalSamples: validSamples };
  }

  // Train the model
  async train(
    classes: ImageClass[],
    config: ModelConfig,
    onProgress: (progress: TrainingProgress) => void
  ): Promise<void> {
    if (!this.mobilenet) {
      throw new Error('Model not initialized. Please refresh the page.');
    }

    // Validate training data
    const validation = this.validateTrainingData(classes);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid training data');
    }

    this.classes = classes;
    const validClasses = validation.validClasses;

    onProgress({
      epoch: 0,
      totalEpochs: config.epochs,
      loss: 0,
      accuracy: 0,
      status: 'preparing',
      message: `Preparing ${validation.totalSamples} samples across ${validClasses.length} classes...`,
    });

    // Collect all features and labels
    const allFeatures: Float32Array[] = [];
    const allLabels: number[] = [];

    for (let classIndex = 0; classIndex < validClasses.length; classIndex++) {
      const imageClass = validClasses[classIndex];
      
      for (const sample of imageClass.samples) {
        if (sample.tensor && sample.tensor.length > 0) {
          allFeatures.push(new Float32Array(sample.tensor));
          allLabels.push(classIndex);
        }
      }
    }

    // Final validation
    if (allFeatures.length === 0) {
      throw new Error('No valid feature vectors found. Please re-add your samples.');
    }

    // Verify all features have the same shape
    const featureSize = allFeatures[0].length;
    const invalidFeatures = allFeatures.filter(f => f.length !== featureSize);
    if (invalidFeatures.length > 0) {
      throw new Error(`Inconsistent feature sizes detected. Please clear samples and re-add.`);
    }

    // Create tensors
    const xs = tf.tensor2d(allFeatures.map(f => Array.from(f)), [allFeatures.length, featureSize]);
    const ys = tf.oneHot(tf.tensor1d(allLabels, 'int32'), validClasses.length);

    // Clean up old classifier
    if (this.classifier) {
      this.classifier.dispose();
    }

    // Build classifier with correct feature size (not shape array)
    this.classifier = this.buildClassifier(validClasses.length, featureSize);

    // Compile model
    this.classifier.compile({
      optimizer: tf.train.adam(config.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    onProgress({
      epoch: 0,
      totalEpochs: config.epochs,
      loss: 0,
      accuracy: 0,
      status: 'training',
      message: 'Training model...',
    });

    // Train the model
    await this.classifier.fit(xs, ys, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          onProgress({
            epoch: epoch + 1,
            totalEpochs: config.epochs,
            loss: logs?.loss || 0,
            accuracy: logs?.acc || 0,
            valLoss: logs?.val_loss,
            valAccuracy: logs?.val_acc,
            status: 'training',
            message: `Epoch ${epoch + 1}/${config.epochs}`,
          });
        },
      },
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    onProgress({
      epoch: config.epochs,
      totalEpochs: config.epochs,
      loss: 0,
      accuracy: 1,
      status: 'complete',
      message: 'Training complete!',
    });
  }

  // Make a prediction
  async predict(imageData: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<PredictionResult[]> {
    if (!this.mobilenet || !this.classifier) {
      throw new Error('Model not trained');
    }

    const validClasses = this.classes.filter(c => c.samples.length > 0);

    return tf.tidy(() => {
      const tensor = this.preprocessImage(imageData);
      const batched = tensor.expandDims(0);
      const features = this.mobilenet!.predict(batched) as tf.Tensor;
      const flatFeatures = features.reshape([1, -1]);
      const predictions = this.classifier!.predict(flatFeatures) as tf.Tensor;
      const probabilities = predictions.dataSync() as Float32Array;

      return validClasses.map((cls, index) => ({
        className: cls.name,
        classId: cls.id,
        confidence: probabilities[index] || 0,
        color: cls.color,
      })).sort((a, b) => b.confidence - a.confidence);
    });
  }

  // Export the model
  async exportModel(format: 'tfjs'): Promise<void> {
    if (!this.classifier) {
      throw new Error('No trained model to export');
    }

    if (format === 'tfjs') {
      await this.classifier.save('downloads://teachable-machine-model');
    }
  }

  // Get class metadata for export
  getClassMetadata(): { name: string; color: string }[] {
    return this.classes.filter(c => c.samples.length > 0).map(c => ({
      name: c.name,
      color: c.color,
    }));
  }

  dispose(): void {
    this.mobilenet?.dispose();
    this.classifier?.dispose();
  }
}

// Singleton instance
let instance: TeachableMachine | null = null;

export function getTeachableMachine(): TeachableMachine {
  if (!instance) {
    instance = new TeachableMachine();
  }
  return instance;
}

export { TeachableMachine };
