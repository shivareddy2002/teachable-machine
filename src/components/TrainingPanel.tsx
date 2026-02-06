import { Play, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { TrainingProgress, ModelConfig } from '@/types/teachable';

interface TrainingPanelProps {
  canTrain: boolean;
  isTraining: boolean;
  isTrained: boolean;
  progress: TrainingProgress | null;
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onTrain: () => void;
}

export function TrainingPanel({
  canTrain,
  isTraining,
  isTrained,
  progress,
  config,
  onConfigChange,
  onTrain,
}: TrainingPanelProps) {
  const progressPercent = progress
    ? (progress.epoch / progress.totalEpochs) * 100
    : 0;

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-medium">Training</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <h4 className="font-medium font-display">Advanced Settings</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Epochs</Label>
                  <span className="text-sm text-muted-foreground">{config.epochs}</span>
                </div>
                <Slider
                  value={[config.epochs]}
                  onValueChange={([value]) => onConfigChange({ ...config, epochs: value })}
                  min={1}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Batch Size</Label>
                  <span className="text-sm text-muted-foreground">{config.batchSize}</span>
                </div>
                <Slider
                  value={[config.batchSize]}
                  onValueChange={([value]) => onConfigChange({ ...config, batchSize: value })}
                  min={4}
                  max={128}
                  step={4}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Learning Rate</Label>
                  <span className="text-sm text-muted-foreground">{config.learningRate.toFixed(4)}</span>
                </div>
                <Slider
                  value={[config.learningRate * 1000]}
                  onValueChange={([value]) => onConfigChange({ ...config, learningRate: value / 1000 })}
                  min={1}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Training status */}
      {progress && isTraining && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progress.message}</span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {progress.status === 'training' && (
            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Loss: </span>
                <span className="font-medium">{progress.loss.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Accuracy: </span>
                <span className="font-medium">{(progress.accuracy * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {progress?.status === 'complete' && (
        <div className="mb-4 p-3 bg-success/10 text-success rounded-lg text-sm font-medium">
          ✓ Training complete! Model is ready for predictions.
        </div>
      )}

      {progress?.status === 'error' && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {progress.message}
        </div>
      )}

      {/* Train button */}
      <Button
        className="w-full"
        size="lg"
        onClick={onTrain}
        disabled={!canTrain || isTraining}
      >
        {isTraining ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Training...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            {isTrained ? 'Retrain Model' : 'Train Model'}
          </>
        )}
      </Button>

      {!canTrain && !isTraining && (
        <p className="text-sm text-muted-foreground mt-3 text-center">
          Add samples to at least 2 classes to start training
        </p>
      )}
    </div>
  );
}
