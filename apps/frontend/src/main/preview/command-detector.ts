import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function detectDevCommand(projectPath: string): string | null {
  return (
    detectFromPackageJson(projectPath) ??
    detectFromProcfile(projectPath) ??
    null
  );
}

function detectFromPackageJson(projectPath: string): string | null {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return null;

  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }

  const scripts = pkg.scripts ?? {};
  if (scripts['dev']) return 'npm run dev';
  if (scripts['start']) return 'npm run start';
  return null;
}

function detectFromProcfile(projectPath: string): string | null {
  const procfilePath = join(projectPath, 'Procfile');
  if (!existsSync(procfilePath)) return null;

  const lines = readFileSync(procfilePath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^web:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}
