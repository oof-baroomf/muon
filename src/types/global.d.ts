export {};

declare global {
  interface Window {
    electronAPI: {
      loadState(): Promise<any>;
      saveState(state: any): void;
    };
  }
}
