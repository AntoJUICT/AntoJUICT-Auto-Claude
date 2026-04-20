const PORT_RANGE_START = 5173;
const PORT_RANGE_END = 5199;

export class PortAllocator {
  private readonly allocated = new Set<number>();

  allocate(): number {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (!this.allocated.has(port)) {
        this.allocated.add(port);
        return port;
      }
    }
    throw new Error('No free preview port available (pool 5173-5199 exhausted)');
  }

  release(port: number): void {
    this.allocated.delete(port);
  }
}

export const portAllocator = new PortAllocator();
