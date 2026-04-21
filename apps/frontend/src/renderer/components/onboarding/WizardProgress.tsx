import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface WizardStep {
  id: string;
  label: string;
  completed: boolean;
}

interface WizardProgressProps {
  currentStep: number;
  steps: WizardStep[];
}

/**
 * Step progress indicator component for the onboarding wizard.
 * Sidebar variant: vertical list with filled green dot (past),
 * cyan ring (current), and muted dot (future).
 */
export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const isCompleted = step.completed;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-3">
            {/* Step indicator dot */}
            {isCompleted ? (
              <div className="h-5 w-5 rounded-full bg-[var(--success)] flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-white" />
              </div>
            ) : isCurrent ? (
              <div className="h-5 w-5 rounded-full border-2 border-[var(--brand-cyan)] bg-transparent shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-[var(--surface-hi)] shrink-0" />
            )}

            {/* Step label */}
            <span
              className={cn(
                'text-[12px] font-medium leading-none',
                isCompleted && 'text-[var(--success)]',
                isCurrent && !isCompleted && 'text-[var(--brand-cyan)]',
                !isCompleted && !isCurrent && 'text-[var(--text-dim)]'
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
