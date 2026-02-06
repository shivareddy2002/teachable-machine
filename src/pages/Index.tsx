import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ClassCard } from '@/components/ClassCard';
import { TrainingPanel } from '@/components/TrainingPanel';
import { PreviewPanel } from '@/components/PreviewPanel';
import { useTeachableMachine } from '@/hooks/useTeachableMachine';
import type { ModelConfig } from '@/types/teachable';

const Index = () => {
  const {
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
  } = useTeachableMachine();

  const [config, setConfig] = useState<ModelConfig>({
    epochs: 50,
    batchSize: 16,
    learningRate: 0.001,
  });

  const handleTrain = () => {
    train(config);
  };

  if (!isModelReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-lg font-display font-medium text-foreground">
          Loading Machine Learning Model...
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          This may take a moment on first load
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Classes Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-display font-semibold">
                Image Samples
              </h2>
              <Button variant="outline" onClick={addClass}>
                <Plus className="h-4 w-4 mr-2" />
                Add a class
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {classes.map((imageClass) => (
                <ClassCard
                  key={imageClass.id}
                  imageClass={imageClass}
                  onRename={(name) => renameClass(imageClass.id, name)}
                  onDelete={() => removeClass(imageClass.id)}
                  onAddSample={(dataUrl, canvas) => addSample(imageClass.id, dataUrl, canvas)}
                  onRemoveSample={(sampleId) => removeSample(imageClass.id, sampleId)}
                  canDelete={classes.length > 2}
                />
              ))}
            </div>

            {/* Instructions */}
            <div className="mt-6 p-6 rounded-xl bg-secondary/50 border border-border">
              <h3 className="font-display font-medium mb-3">How to use</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">1</span>
                  <span>Create classes and add image samples using your webcam or by uploading images</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">2</span>
                  <span>Click "Train Model" to train your custom image classifier</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">3</span>
                  <span>Use the preview panel to see real-time predictions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">4</span>
                  <span>Export your model to use in your own projects</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Training & Preview Column */}
          <div className="space-y-6">
            <TrainingPanel
              canTrain={canTrain}
              isTraining={isTraining}
              isTrained={isTrained}
              progress={trainingProgress}
              config={config}
              onConfigChange={setConfig}
              onTrain={handleTrain}
            />

            <PreviewPanel
              predictions={predictions}
              isTrained={isTrained}
              onPredict={predict}
              onExport={exportModel}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
