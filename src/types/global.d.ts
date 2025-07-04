export {};

declare global {
  interface Window {
    electronAPI: {
      loadState(): Promise<any>;
      saveState(state: any): void;
      send(channel: string, ...args: any[]): void;
      receive(channel: string, func: (...args: any[]) => void): () => void;
    };
  }
}
