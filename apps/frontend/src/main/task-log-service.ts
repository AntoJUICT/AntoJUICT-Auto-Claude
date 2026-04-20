import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import type { TaskLogs, TaskLogPhase, TaskLogStreamChunk, TaskPhaseLog } from '../shared/types';
import { findTaskWorktree } from './worktree-paths';
import { debugLog, debugWarn, debugError } from '../shared/utils/debug-logger';

function findWorktreeSpecDir(projectPath: string, specId: string, specsRelPath: string): string | null {
  const worktreePath = findTaskWorktree(projectPath, specId);
  if (worktreePath) {
    return path.join(worktreePath, specsRelPath, specId);
  }
  return null;
}

/**
 * Service for loading and watching phase-based task logs (task_logs.json)
 *
 * Uses chokidar file watching instead of polling to avoid blocking the main
 * process with repeated readFileSync calls every second.
 */
export class TaskLogService extends EventEmitter {
  private logCache: Map<string, TaskLogs> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  // Lightweight discovery intervals (5s) used only until worktree is found
  private discoveryIntervals: Map<string, NodeJS.Timeout> = new Map();
  private watchedPaths: Map<string, { mainSpecDir: string; worktreeSpecDir: string | null; specsRelPath: string }> = new Map();

  /**
   * Load task logs from a single spec directory
   * Returns cached logs if the file is corrupted (e.g., mid-write by Python backend)
   */
  loadLogsFromPath(specDir: string): TaskLogs | null {
    const logFile = path.join(specDir, 'task_logs.json');

    debugLog('[TaskLogService.loadLogsFromPath] Attempting to load logs:', {
      specDir,
      logFile,
      exists: existsSync(logFile)
    });

    if (!existsSync(logFile)) {
      debugLog('[TaskLogService.loadLogsFromPath] Log file does not exist:', logFile);
      return null;
    }

    try {
      const content = readFileSync(logFile, 'utf-8');
      const logs = JSON.parse(content) as TaskLogs;

      debugLog('[TaskLogService.loadLogsFromPath] Successfully loaded logs:', {
        specDir,
        specId: logs.spec_id,
        phases: Object.keys(logs.phases),
        entryCounts: {
          planning: logs.phases.planning?.entries?.length || 0,
          coding: logs.phases.coding?.entries?.length || 0,
          validation: logs.phases.validation?.entries?.length || 0
        }
      });

      this.logCache.set(specDir, logs);
      return logs;
    } catch (error) {
      // JSON parse error - file may be mid-write, return cached version if available
      const cached = this.logCache.get(specDir);
      if (cached) {
        debugWarn('[TaskLogService.loadLogsFromPath] Parse error, returning cached logs:', {
          specDir,
          error: error instanceof Error ? error.message : String(error)
        });
        return cached;
      }
      debugError('[TaskLogService.loadLogsFromPath] Failed to load logs (no cache):', {
        logFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Merge logs from main and worktree spec directories
   */
  private mergeLogs(mainLogs: TaskLogs | null, worktreeLogs: TaskLogs | null, specDir: string): TaskLogs | null {
    debugLog('[TaskLogService.mergeLogs] Merging logs:', {
      specDir,
      hasMainLogs: !!mainLogs,
      hasWorktreeLogs: !!worktreeLogs,
      mainEntries: mainLogs ? {
        planning: mainLogs.phases.planning?.entries?.length || 0,
        coding: mainLogs.phases.coding?.entries?.length || 0,
        validation: mainLogs.phases.validation?.entries?.length || 0
      } : null,
      worktreeEntries: worktreeLogs ? {
        planning: worktreeLogs.phases.planning?.entries?.length || 0,
        coding: worktreeLogs.phases.coding?.entries?.length || 0,
        validation: worktreeLogs.phases.validation?.entries?.length || 0
      } : null
    });

    if (!worktreeLogs) {
      debugLog('[TaskLogService.mergeLogs] No worktree logs, using main logs only');
      if (mainLogs) {
        this.logCache.set(specDir, mainLogs);
      }
      return mainLogs;
    }

    if (!mainLogs) {
      debugLog('[TaskLogService.mergeLogs] No main logs, using worktree logs only');
      this.logCache.set(specDir, worktreeLogs);
      return worktreeLogs;
    }

    // Merge logs: planning from main, coding/validation from worktree (if available)
    const mergedLogs: TaskLogs = {
      spec_id: mainLogs.spec_id,
      created_at: mainLogs.created_at,
      updated_at: worktreeLogs.updated_at > mainLogs.updated_at ? worktreeLogs.updated_at : mainLogs.updated_at,
      phases: {
        planning: mainLogs.phases.planning || worktreeLogs.phases.planning,
        coding: (worktreeLogs.phases.coding?.entries?.length > 0 || worktreeLogs.phases.coding?.status !== 'pending')
          ? worktreeLogs.phases.coding
          : mainLogs.phases.coding,
        validation: (worktreeLogs.phases.validation?.entries?.length > 0 || worktreeLogs.phases.validation?.status !== 'pending')
          ? worktreeLogs.phases.validation
          : mainLogs.phases.validation
      }
    };

    debugLog('[TaskLogService.mergeLogs] Merged logs created:', {
      specDir,
      mergedEntries: {
        planning: mergedLogs.phases.planning?.entries?.length || 0,
        coding: mergedLogs.phases.coding?.entries?.length || 0,
        validation: mergedLogs.phases.validation?.entries?.length || 0
      },
      source: {
        planning: mainLogs.phases.planning ? 'main' : 'worktree',
        coding: (worktreeLogs.phases.coding?.entries?.length > 0 || worktreeLogs.phases.coding?.status !== 'pending') ? 'worktree' : 'main',
        validation: (worktreeLogs.phases.validation?.entries?.length > 0 || worktreeLogs.phases.validation?.status !== 'pending') ? 'worktree' : 'main'
      }
    });

    this.logCache.set(specDir, mergedLogs);
    return mergedLogs;
  }

  /**
   * Load and merge task logs from main spec dir and worktree spec dir
   */
  loadLogs(specDir: string, projectPath?: string, specsRelPath?: string, specId?: string): TaskLogs | null {
    debugLog('[TaskLogService.loadLogs] Loading logs:', {
      specDir,
      projectPath,
      specsRelPath,
      specId,
      watchedPathsCount: this.watchedPaths.size
    });

    const mainLogs = this.loadLogsFromPath(specDir);

    const watchedInfo = Array.from(this.watchedPaths.entries()).find(
      ([_, info]) => info.mainSpecDir === specDir
    );

    let worktreeSpecDir: string | null = null;

    if (watchedInfo?.[1].worktreeSpecDir) {
      worktreeSpecDir = watchedInfo[1].worktreeSpecDir;
      debugLog('[TaskLogService.loadLogs] Found worktree from watched paths:', worktreeSpecDir);
    } else if (projectPath && specsRelPath && specId) {
      worktreeSpecDir = findWorktreeSpecDir(projectPath, specId, specsRelPath);
      debugLog('[TaskLogService.loadLogs] Calculated worktree path:', {
        worktreeSpecDir,
        projectPath,
        specId,
        specsRelPath
      });
    }

    if (!worktreeSpecDir) {
      debugLog('[TaskLogService.loadLogs] No worktree found, using main logs only');
      if (mainLogs) {
        this.logCache.set(specDir, mainLogs);
      }
      return mainLogs;
    }

    const worktreeLogs = this.loadLogsFromPath(worktreeSpecDir);

    return this.mergeLogs(mainLogs, worktreeLogs, specDir);
  }

  /**
   * Get the currently active phase from logs
   */
  getActivePhase(specDir: string): TaskLogPhase | null {
    const logs = this.loadLogs(specDir);
    if (!logs) return null;

    const phases: TaskLogPhase[] = ['planning', 'coding', 'validation'];
    for (const phase of phases) {
      if (logs.phases[phase]?.status === 'active') {
        return phase;
      }
    }
    return null;
  }

  /**
   * Get logs for a specific phase
   */
  getPhaseLog(specDir: string, phase: TaskLogPhase): TaskPhaseLog | null {
    const logs = this.loadLogs(specDir);
    if (!logs) return null;
    return logs.phases[phase] || null;
  }

  /**
   * Start watching a spec directory for log changes using chokidar (event-driven,
   * no constant disk reads).
   *
   * A lightweight discovery interval (5 s) runs only when the worktree path is not
   * yet known; it stops as soon as the worktree is found and added to the watcher.
   */
  startWatching(specId: string, specDir: string, projectPath?: string, specsRelPath?: string): void {
    debugLog('[TaskLogService.startWatching] Starting watch:', {
      specId,
      specDir,
      projectPath,
      specsRelPath
    });

    const existingWatch = this.watchedPaths.get(specId);
    if (existingWatch && existingWatch.mainSpecDir === specDir) {
      debugLog('[TaskLogService.startWatching] Already watching this spec, skipping');
      return;
    }

    this.stopWatching(specId);

    const mainLogFile = path.join(specDir, 'task_logs.json');

    let worktreeSpecDir: string | null = null;
    if (projectPath && specsRelPath) {
      worktreeSpecDir = findWorktreeSpecDir(projectPath, specId, specsRelPath);
    }

    this.watchedPaths.set(specId, {
      mainSpecDir: specDir,
      worktreeSpecDir,
      specsRelPath: specsRelPath || ''
    });

    // Initial load
    debugLog('[TaskLogService.startWatching] Loading initial logs');
    const initialLogs = this.loadLogs(specDir);
    if (initialLogs) {
      debugLog('[TaskLogService.startWatching] Initial logs loaded:', {
        specId: initialLogs.spec_id,
        entryCounts: {
          planning: initialLogs.phases.planning?.entries?.length || 0,
          coding: initialLogs.phases.coding?.entries?.length || 0,
          validation: initialLogs.phases.validation?.entries?.length || 0
        }
      });
      this.logCache.set(specDir, initialLogs);
    } else {
      debugLog('[TaskLogService.startWatching] No initial logs found');
    }

    // Build list of files to watch (only files that currently exist)
    const filesToWatch: string[] = [];
    if (existsSync(mainLogFile)) {
      filesToWatch.push(mainLogFile);
    }
    if (worktreeSpecDir) {
      const worktreeLogFile = path.join(worktreeSpecDir, 'task_logs.json');
      if (existsSync(worktreeLogFile)) {
        filesToWatch.push(worktreeLogFile);
      }
    }

    const handleChange = () => {
      const previousLogs = this.logCache.get(specDir);
      const logs = this.loadLogs(specDir);

      if (logs) {
        debugLog('[TaskLogService] Log file changed, emitting logs-changed:', {
          specId,
          entryCounts: {
            planning: logs.phases.planning?.entries?.length || 0,
            coding: logs.phases.coding?.entries?.length || 0,
            validation: logs.phases.validation?.entries?.length || 0
          }
        });
        this.emit('logs-changed', specId, logs);
        this.emitNewEntries(specId, previousLogs, logs);
      } else {
        debugWarn('[TaskLogService] No logs loaded after file change:', specId);
      }
    };

    // Also watch the main log file if it doesn't exist yet (chokidar can watch
    // non-existent files and fires 'add' when they appear)
    const watcher = chokidar.watch(filesToWatch.length > 0 ? filesToWatch : mainLogFile, {
      persistent: false,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    watcher.on('add', handleChange);
    watcher.on('change', handleChange);

    this.watchers.set(specId, watcher);

    debugLog('[TaskLogService] Started chokidar watch for spec:', {
      specId,
      mainSpecDir: specDir,
      worktreeSpecDir: worktreeSpecDir || 'none',
      watchedFiles: filesToWatch,
    });

    // If worktree not yet known, poll lightly (every 5 s, max 24 attempts = 2 min)
    // to discover it and add it to the existing watcher.
    if (!worktreeSpecDir && projectPath && specsRelPath) {
      let discoveryAttempts = 0;
      const maxDiscoveryAttempts = 24;

      const discoveryInterval = setInterval(() => {
        discoveryAttempts++;

        const discovered = findWorktreeSpecDir(projectPath, specId, specsRelPath);
        if (discovered) {
          clearInterval(discoveryInterval);
          this.discoveryIntervals.delete(specId);

          const watchedInfo = this.watchedPaths.get(specId);
          if (watchedInfo) {
            this.watchedPaths.set(specId, { ...watchedInfo, worktreeSpecDir: discovered });
          }

          const worktreeLogFile = path.join(discovered, 'task_logs.json');
          const existingWatcher = this.watchers.get(specId);
          if (existingWatcher) {
            existingWatcher.add(worktreeLogFile);
            debugLog('[TaskLogService] Added worktree to watcher:', { specId, worktreeLogFile });
          }
        } else if (discoveryAttempts >= maxDiscoveryAttempts) {
          clearInterval(discoveryInterval);
          this.discoveryIntervals.delete(specId);
          debugLog('[TaskLogService] Gave up worktree discovery after max attempts:', specId);
        }
      }, 5000);

      this.discoveryIntervals.set(specId, discoveryInterval);
    }
  }

  /**
   * Stop watching a spec directory
   */
  stopWatching(specId: string): void {
    const watcher = this.watchers.get(specId);
    if (watcher) {
      debugLog('[TaskLogService.stopWatching] Stopping watcher for spec:', specId);
      watcher.close().catch(() => {});
      this.watchers.delete(specId);
    }

    const discoveryInterval = this.discoveryIntervals.get(specId);
    if (discoveryInterval) {
      clearInterval(discoveryInterval);
      this.discoveryIntervals.delete(specId);
    }

    this.watchedPaths.delete(specId);
  }

  /**
   * Stop all watches
   */
  stopAllWatching(): void {
    for (const specId of [...this.watchers.keys(), ...this.discoveryIntervals.keys()]) {
      this.stopWatching(specId);
    }
  }

  /**
   * Emit streaming updates for new log entries
   */
  private emitNewEntries(specId: string, previousLogs: TaskLogs | undefined, currentLogs: TaskLogs): void {
    const phases: TaskLogPhase[] = ['planning', 'coding', 'validation'];

    for (const phase of phases) {
      const prevPhase = previousLogs?.phases[phase];
      const currPhase = currentLogs.phases[phase];

      if (!currPhase) continue;

      // Check for phase status changes
      if (prevPhase?.status !== currPhase.status) {
        if (currPhase.status === 'active') {
          this.emit('stream-chunk', specId, {
            type: 'phase_start',
            phase,
            timestamp: currPhase.started_at || new Date().toISOString()
          } as TaskLogStreamChunk);
        } else if (currPhase.status === 'completed' || currPhase.status === 'failed') {
          this.emit('stream-chunk', specId, {
            type: 'phase_end',
            phase,
            timestamp: currPhase.completed_at || new Date().toISOString()
          } as TaskLogStreamChunk);
        }
      }

      // Check for new entries
      const prevEntryCount = prevPhase?.entries.length || 0;
      const currEntryCount = currPhase.entries.length;

      if (currEntryCount > prevEntryCount) {
        for (let i = prevEntryCount; i < currEntryCount; i++) {
          const entry = currPhase.entries[i];

          const streamUpdate: TaskLogStreamChunk = {
            type: entry.type as TaskLogStreamChunk['type'],
            content: entry.content,
            phase: entry.phase,
            timestamp: entry.timestamp,
            subtask_id: entry.subtask_id
          };

          if (entry.tool_name) {
            streamUpdate.tool = {
              name: entry.tool_name,
              input: entry.tool_input
            };
          }

          this.emit('stream-chunk', specId, streamUpdate);
        }
      }
    }
  }

  /**
   * Get cached logs without re-reading from disk
   */
  getCachedLogs(specDir: string): TaskLogs | null {
    return this.logCache.get(specDir) || null;
  }

  /**
   * Clear the log cache for a spec
   */
  clearCache(specDir: string): void {
    this.logCache.delete(specDir);
  }

  /**
   * Check if logs exist for a spec
   */
  hasLogs(specDir: string): boolean {
    const logFile = path.join(specDir, 'task_logs.json');
    return existsSync(logFile);
  }
}

// Singleton instance
export const taskLogService = new TaskLogService();
