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

  // Extend CSSStyleDeclaration to include non-standard 'zoom' property used in renderer code
  interface CSSStyleDeclaration {
    /**
     * Non-standard zoom style (supported by Chromium, Safari, etc.).
     * Declared here so TypeScript accepts `element.style.zoom`.
     */
    zoom?: string | number;
  }
}
