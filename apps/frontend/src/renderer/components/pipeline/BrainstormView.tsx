import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../../stores/pipeline-store';
import { cn } from '../../lib/utils';

interface BrainstormViewProps {
  onReadyToPlan: (specSummary: string) => void;
  taskDescription?: string;
  taskId: string;
}

export function BrainstormView({ onReadyToPlan, taskDescription, taskId }: BrainstormViewProps) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasAutoSentRef = useRef(false);
  const isMountedRef = useRef(true);

  const messages = usePipelineStore((s) => s.messages);
  const isBrainstormLoading = usePipelineStore((s) => s.isBrainstormLoading);
  const projectDir = usePipelineStore((s) => s.projectDir);
  const addMessage = usePipelineStore((s) => s.addMessage);
  const setBrainstormLoading = usePipelineStore((s) => s.setBrainstormLoading);
  const setSpecSummary = usePipelineStore((s) => s.setSpecSummary);
  const setVisualUrl = usePipelineStore((s) => s.setVisualUrl);
  const setHasVisual = usePipelineStore((s) => s.setHasVisual);
  const visualUrl = usePipelineStore((s) => s.visualUrl);

  // Track mount state to guard async callbacks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear visual state from any previous session on mount
  useEffect(() => {
    setVisualUrl(null);
    setHasVisual(false);
  }, [setVisualUrl, setHasVisual]);

  // Stop Visual Companion server on unmount
  useEffect(() => {
    return () => {
      void window.electronAPI.pipeline.stopVisualCompanion(taskId).catch(console.error);
    };
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 || !projectDir || hasAutoSentRef.current) return;
    hasAutoSentRef.current = true;

    if (taskDescription?.trim()) {
      const userMsg = { role: 'user' as const, content: taskDescription.trim() };
      addMessage(userMsg);
      setBrainstormLoading(true);

      window.electronAPI.pipeline
        .sendBrainstormMessage([userMsg], projectDir, taskId)
        .then((result) => {
          if (!isMountedRef.current) return;
          if (result.success && result.data) {
            addMessage({ role: 'assistant', content: result.data.response });
            if (result.data.visual_url) {
              setVisualUrl(result.data.visual_url);
              setHasVisual(true);
            }
            if (result.data.ready_to_plan && result.data.spec_summary) {
              setSpecSummary(result.data.spec_summary);
              onReadyToPlan(result.data.spec_summary);
            }
          } else {
            addMessage({ role: 'assistant', content: `Er ging iets mis: ${result.error || 'Onbekende fout'}` });
          }
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          addMessage({ role: 'assistant', content: `Er ging iets mis: ${err instanceof Error ? err.message : String(err)}` });
        })
        .finally(() => {
          if (isMountedRef.current) setBrainstormLoading(false);
        });
    } else {
      addMessage({
        role: 'assistant',
        content: 'Wat wil je bouwen? Beschrijf het zo concreet mogelijk.',
      });
    }
  }, [messages.length, projectDir, taskDescription, taskId, addMessage, setBrainstormLoading, setSpecSummary, setVisualUrl, setHasVisual, onReadyToPlan]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isBrainstormLoading || !projectDir) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    addMessage({ role: 'user', content: text });
    setInput('');
    setBrainstormLoading(true);

    try {
      const result = await window.electronAPI.pipeline.sendBrainstormMessage(
        newMessages,
        projectDir,
        taskId,
      );

      if (!isMountedRef.current) return;

      if (result.success && result.data) {
        addMessage({ role: 'assistant', content: result.data.response });

        if (result.data.visual_url) {
          setVisualUrl(result.data.visual_url);
          setHasVisual(true);
        }

        if (result.data.ready_to_plan && result.data.spec_summary) {
          setSpecSummary(result.data.spec_summary);
          onReadyToPlan(result.data.spec_summary);
        }
      } else {
        addMessage({
          role: 'assistant',
          content: `Er ging iets mis: ${result.error || 'Onbekende fout'}`,
        });
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      addMessage({
        role: 'assistant',
        content: `Er ging iets mis: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      if (isMountedRef.current) setBrainstormLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Brainstorm</h2>
        <p className="text-xs text-muted-foreground">Beschrijf wat je wil bouwen</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isBrainstormLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground animate-pulse">
              Claude denkt na...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-[120px]"
            placeholder="Typ je antwoord... (Enter om te versturen)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBrainstormLoading}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isBrainstormLoading || !input.trim()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            Sturen
          </button>
          {visualUrl && (
            <button
              onClick={() => window.electronAPI.openExternal(visualUrl)}
              className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              {t('brainstorm.openPreview')}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Shift+Enter voor nieuwe regel
        </p>
      </div>
    </div>
  );
}
