export interface InfraGeneratorSchema {
  name: string;
  directory?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  skipInstall?: boolean;
}
