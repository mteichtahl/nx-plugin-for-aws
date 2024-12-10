import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { SupportedStyles } from '@nx/react';
import { Linter } from '@nx/eslint';

export interface AppGeneratorSchema {
  name: string;
  style: SupportedStyles;
  skipFormat?: boolean;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  inSourceTests?: boolean;
  // TODO: consider exposing if swc paths issue can be addressed https://github.com/swc-project/swc/discussions/8396
  // or if alternative compiler can be used for e2e tests
  // e2eTestRunner: 'cypress' | 'playwright' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  skipNxJson?: boolean;
  js?: boolean;
  globalCss?: boolean;
  strict?: boolean;
  setParserOptionsProject?: boolean;
  compiler?: 'babel' | 'swc';
  remotes?: string[];
  devServerPort?: number;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  bundler?: 'webpack' | 'vite' | 'rspack';
  minimal?: boolean;
  addPlugin?: boolean;
  skipInstall?: boolean;
}
