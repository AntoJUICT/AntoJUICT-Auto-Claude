import type { CompletablePhase } from '@shared/constants/phase-protocol';

const PHASE_SEGMENTS: { phase: CompletablePhase; color: string }[] = [
  { phase: 'planning', color: '#f59e0b' },
  { phase: 'coding', color: '#10b981' },
  { phase: 'qa_review', color: '#60a5fa' },
  { phase: 'qa_fixing', color: '#2563eb' },
];

interface PhaseProgressBarProps {
  completedPhases: CompletablePhase[];
}

export function PhaseProgressBar({ completedPhases }: PhaseProgressBarProps) {
  if (completedPhases.length === 0) return null;

  return (
    <div className="mt-2 flex gap-px">
      {PHASE_SEGMENTS.map(({ phase, color }) => (
        <div
          key={phase}
          className="h-[3px] flex-1 rounded-sm"
          style={{
            backgroundColor: color,
            opacity: completedPhases.includes(phase) ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}
