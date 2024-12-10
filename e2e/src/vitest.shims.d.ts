declare module 'vitest' {
    export interface ProvidedContext {
      publishedVersion: string
    }
  }
  
  // mark this file as a module so augmentation works correctly
  export {}