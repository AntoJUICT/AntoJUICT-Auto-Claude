import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore, saveSettings as saveSettingsToStore, loadSettings as loadSettingsFromStore } from '../../../stores/settings-store';
import type { AppSettings } from '../../../../shared/types';
import { UI_SCALE_DEFAULT } from '../../../../shared/constants';

/**
 * Custom hook for managing application settings
 * Provides state management and save/load functionality
 *
 * Theme and UI scale changes are applied immediately for live preview. If the user
 * cancels without saving, call revertTheme() to restore the original values.
 */
export function useSettings() {
  const currentSettings = useSettingsStore((state) => state.settings);
  const updateStoreSettings = useSettingsStore((state) => state.updateSettings);
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalThemeRef = useRef<{
    theme: AppSettings['theme'];
    uiScale: number;
  }>({
    theme: currentSettings.theme,
    uiScale: currentSettings.uiScale ?? UI_SCALE_DEFAULT
  });

  // Sync with store
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  // Load settings on mount
  useEffect(() => {
    loadSettingsFromStore();
  }, []);

  // Capture original theme/scale when store values change (for revert on cancel)
  useEffect(() => {
    originalThemeRef.current = {
      theme: currentSettings.theme,
      uiScale: currentSettings.uiScale ?? UI_SCALE_DEFAULT
    };
  }, [currentSettings.theme, currentSettings.uiScale]);

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const success = await saveSettingsToStore(settings);
      if (success) {
        applyTheme(settings.theme);
        return true;
      } else {
        setError('Failed to save settings');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.remove('light');
        root.classList.remove('dark');
      }
    }
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  /**
   * Revert theme to the original values (before any preview changes).
   * Call this when the user cancels the settings dialog without saving.
   */
  const revertTheme = useCallback(() => {
    const original = originalThemeRef.current;
    updateStoreSettings({
      theme: original.theme,
      uiScale: original.uiScale
    });
  }, [updateStoreSettings]);

  /**
   * Capture the current theme as the new "original" after successful save.
   * This updates the reference point for future reverts.
   */
  const commitTheme = useCallback(() => {
    originalThemeRef.current = {
      theme: settings.theme,
      uiScale: settings.uiScale ?? UI_SCALE_DEFAULT
    };
  }, [settings.theme, settings.uiScale]);

  return {
    settings,
    setSettings,
    updateSettings,
    isSaving,
    error,
    saveSettings,
    applyTheme,
    revertTheme,
    commitTheme
  };
}
