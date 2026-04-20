/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalActions } from '../ApprovalActions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'approval.spec_review.approve': 'Approve spec',
        'approval.plan_review.approve': 'Approve plan',
        'approval.preview.approve': 'Approve → PR',
        'approval.sendBack': 'Send back',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('ApprovalActions', () => {
  it('renders approve and send-back for spec_review', () => {
    render(<ApprovalActions status="spec_review" onApprove={vi.fn()} onSendBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Approve spec' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send back' })).toBeInTheDocument();
  });

  it('calls onApprove when approve clicked', () => {
    const onApprove = vi.fn();
    render(<ApprovalActions status="spec_review" onApprove={onApprove} onSendBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve spec' }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('calls onSendBack when send back clicked', () => {
    const onSendBack = vi.fn();
    render(<ApprovalActions status="plan_review" onApprove={vi.fn()} onSendBack={onSendBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    expect(onSendBack).toHaveBeenCalledOnce();
  });

  it('renders correct approve label for plan_review', () => {
    render(<ApprovalActions status="plan_review" onApprove={vi.fn()} onSendBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeInTheDocument();
  });

  it('renders correct approve label for preview', () => {
    render(<ApprovalActions status="preview" onApprove={vi.fn()} onSendBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Approve → PR' })).toBeInTheDocument();
  });

  it('renders nothing for non-approval statuses', () => {
    const { container } = render(
      <ApprovalActions status="in_progress" onApprove={vi.fn()} onSendBack={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for backlog', () => {
    const { container } = render(
      <ApprovalActions status="backlog" onApprove={vi.fn()} onSendBack={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
