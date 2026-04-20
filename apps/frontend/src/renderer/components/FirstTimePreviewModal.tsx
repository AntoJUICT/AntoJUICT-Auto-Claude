import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

const STORAGE_KEY = 'preview_first_time_shown';

export function hasSeenPreviewModal(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markPreviewModalSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable — ignore
  }
}

interface FirstTimePreviewModalProps {
  open: boolean;
  onClose: () => void;
}

export function FirstTimePreviewModal({ open, onClose }: FirstTimePreviewModalProps) {
  const { t } = useTranslation('kanban');
  const [dontShowChecked, setDontShowChecked] = useState(false);

  function handleDismiss() {
    if (dontShowChecked) {
      markPreviewModalSeen();
    }
    onClose();
  }

  function handleDontShowAgain() {
    markPreviewModalSeen();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <DialogTitle>{t('preview.firstTime.title')}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {t('preview.firstTime.description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={handleDontShowAgain}>
            {t('preview.firstTime.dontShowAgain')}
          </Button>
          <Button size="sm" onClick={handleDismiss}>
            {t('preview.firstTime.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
