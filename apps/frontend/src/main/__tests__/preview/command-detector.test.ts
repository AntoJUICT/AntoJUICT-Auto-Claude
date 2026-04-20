import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { detectDevCommand } from '../../preview/command-detector';
import os from 'os';

function makeTempDir(name: string): string {
  const dir = join(os.tmpdir(), `cmd-detect-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('detectDevCommand', () => {
  it('detects dev script from package.json', () => {
    const dir = makeTempDir('vite');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
    expect(detectDevCommand(dir)).toBe('npm run dev');
    rmSync(dir, { recursive: true });
  });

  it('prefers dev over start', () => {
    const dir = makeTempDir('prefer');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'node s', dev: 'next dev' } }));
    expect(detectDevCommand(dir)).toBe('npm run dev');
    rmSync(dir, { recursive: true });
  });

  it('falls back to start when no dev', () => {
    const dir = makeTempDir('start');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'react-scripts start' } }));
    expect(detectDevCommand(dir)).toBe('npm run start');
    rmSync(dir, { recursive: true });
  });

  it('detects Procfile web entry', () => {
    const dir = makeTempDir('procfile');
    writeFileSync(join(dir, 'Procfile'), 'web: bundle exec rails server\nworker: sidekiq\n');
    expect(detectDevCommand(dir)).toBe('bundle exec rails server');
    rmSync(dir, { recursive: true });
  });

  it('returns null when no dev command found', () => {
    const dir = makeTempDir('empty');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));
    expect(detectDevCommand(dir)).toBeNull();
    rmSync(dir, { recursive: true });
  });
});
