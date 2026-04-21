import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskChatPhaseProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onSkip: () => void;
  onConfirmGenerate: () => void;
  onAddMore: () => void;
  isLoading: boolean;
  isAiReady: boolean;
  step: number;
  maxSteps: number;
}

export function TaskChatPhase({
  messages,
  onSend,
  onSkip,
  onConfirmGenerate,
  onAddMore,
  isLoading,
  isAiReady,
  step,
  maxSteps,
}: TaskChatPhaseProps) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiReady]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {msg.role === 'assistant' && (
                <span className="mr-2 text-xs opacity-60">🤖</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('chat.generating')}
            </div>
          </div>
        )}

        {/* AI-ready confirmation */}
        {isAiReady && !isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3 space-y-3 max-w-[85%]">
              <p className="text-sm font-medium">{t('chat.aiReady')}</p>
              <p className="text-sm text-muted-foreground">{t('chat.aiReadyQuestion')}</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={onAddMore}>
                  {t('chat.addMore')}
                </Button>
                <Button size="sm" onClick={onConfirmGenerate}>
                  {t('chat.generate')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area — hidden when AI is ready */}
      {!isAiReady && (
        <div className="mt-3 flex gap-2">
          <textarea
            className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('chat.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <Button
            size="sm"
            className="h-10 px-3"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">{t('chat.send')}</span>
          </Button>
        </div>
      )}

      {/* Step indicator + skip */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('chat.stepIndicator', { current: step, max: maxSteps })}
        </span>
        <button
          type="button"
          className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          onClick={onSkip}
        >
          {t('chat.skip')}
        </button>
      </div>
    </div>
  );
}
