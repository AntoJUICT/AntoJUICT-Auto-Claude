/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { SubtaskProgress } from '../SubtaskProgress';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'subtaskProgress.label') {
        return `Subtask ${opts?.current}/${opts?.total} — ${opts?.phase}`;
      }
      if (key.startsWith('subtaskPhase.')) return key.split('.')[1];
      return key;
    },
  }),
}));

describe('SubtaskProgress', () => {
  it('shows 1-based subtask index and total', () => {
    render(<SubtaskProgress currentIndex={2} total={8} agentPhase="implementing" />);
    expect(screen.getByText(/Subtask 3\/8/)).toBeInTheDocument();
  });

  it('shows agent phase label', () => {
    render(<SubtaskProgress currentIndex={0} total={5} agentPhase="spec_review" />);
    expect(screen.getByText(/spec_review/)).toBeInTheDocument();
  });

  it('shows correct progress percentage on progressbar', () => {
    render(<SubtaskProgress currentIndex={3} total={8} agentPhase="quality_review" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '37');
  });

  it('shows 0% for first subtask', () => {
    render(<SubtaskProgress currentIndex={0} total={4} agentPhase="implementing" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows 100% when all subtasks done', () => {
    render(<SubtaskProgress currentIndex={4} total={4} agentPhase="done" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});
