/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PhaseProgressBar } from '../PhaseProgressBar';

describe('PhaseProgressBar', () => {
  it('renders nothing when completedPhases is empty or undefined', () => {
    const { container: c1 } = render(<PhaseProgressBar completedPhases={[]} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<PhaseProgressBar />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders 4 segments', () => {
    const { container } = render(<PhaseProgressBar completedPhases={['planning']} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.childElementCount).toBe(4);
  });

  it('first segment has full opacity when planning is complete', () => {
    const { container } = render(<PhaseProgressBar completedPhases={['planning']} />);
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments[0].style.opacity).toBe('1');
    expect(segments[1].style.opacity).toBe('0.15');
    expect(segments[2].style.opacity).toBe('0.15');
    expect(segments[3].style.opacity).toBe('0.15');
  });

  it('all segments have full opacity when all phases complete', () => {
    const { container } = render(
      <PhaseProgressBar completedPhases={['planning', 'coding', 'qa_review', 'qa_fixing']} />
    );
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    for (const seg of segments) {
      expect(seg.style.opacity).toBe('1');
    }
  });

  it('segments have correct colors', () => {
    const { container } = render(
      <PhaseProgressBar completedPhases={['planning', 'coding', 'qa_review', 'qa_fixing']} />
    );
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments[0].style.backgroundColor).toBe('rgb(245, 158, 11)');   // #f59e0b amber
    expect(segments[1].style.backgroundColor).toBe('rgb(16, 185, 129)');   // #10b981 emerald
    expect(segments[2].style.backgroundColor).toBe('rgb(96, 165, 250)');   // #60a5fa blue-400
    expect(segments[3].style.backgroundColor).toBe('rgb(37, 99, 235)');    // #2563eb blue-600
  });
});
