import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator } from '../../preview/port-allocator';

describe('PortAllocator', () => {
  let allocator: PortAllocator;

  beforeEach(() => {
    allocator = new PortAllocator();
  });

  it('allocates first port in range (5173)', () => {
    expect(allocator.allocate()).toBe(5173);
  });

  it('allocates next free port after release', () => {
    const p1 = allocator.allocate();
    const p2 = allocator.allocate();
    allocator.release(p1);
    expect(allocator.allocate()).toBe(p1);
    allocator.release(p2);
  });

  it('throws when pool is exhausted', () => {
    for (let i = 0; i < 27; i++) allocator.allocate();
    expect(() => allocator.allocate()).toThrow('No free preview port available');
  });

  it('released port becomes available again', () => {
    const p = allocator.allocate();
    allocator.release(p);
    expect(allocator.allocate()).toBe(p);
  });
});
