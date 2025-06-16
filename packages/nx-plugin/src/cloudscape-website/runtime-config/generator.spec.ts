/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Tree } from '@nx/devkit';
import {
  RUNTIME_CONFIG_GENERATOR_INFO,
  runtimeConfigGenerator,
} from './generator';
import { RuntimeConfigGeneratorSchema } from './schema';
import { createTreeUsingTsSolutionSetup } from '../../utils/test';
import { sharedConstructsGenerator } from '../../utils/shared-constructs';
import { expectHasMetricTags } from '../../utils/metrics.spec';

describe('runtime-config generator', () => {
  let tree: Tree;

  const options: RuntimeConfigGeneratorSchema = {
    project: 'test-app',
  };

  beforeEach(() => {
    tree = createTreeUsingTsSolutionSetup();
    tree.write(
      'packages/test-app/project.json',
      JSON.stringify({
        name: 'test-app',
        sourceRoot: 'packages/test-app/src',
      }),
    );
  });

  it('should generate runtime config files', async () => {
    // Set up a basic React app structure
    tree.write(
      'packages/test-app/src/main.tsx',
      `import { RouterProvider } from '@tanstack/react-router';

        export function App() {
        
          const App = () => <RouterProvider router={router} />;

          return (
            <App/>
          );
        }`,
    );
    await runtimeConfigGenerator(tree, options);
    // Check if RuntimeConfig component was generated
    expect(
      tree.exists('packages/test-app/src/components/RuntimeConfig/index.tsx'),
    ).toBeTruthy();
    // Snapshot the generated RuntimeConfig component
    expect(
      tree
        .read('packages/test-app/src/components/RuntimeConfig/index.tsx')
        ?.toString(),
    ).toMatchSnapshot('runtime-config-component.tsx');
  });

  it('should modify main.tsx correctly', async () => {
    // Set up a basic React app structure
    tree.write(
      'packages/test-app/src/main.tsx',
      `import { RouterProvider } from '@tanstack/react-router';

        export function App() {
        
          const App = () => <RouterProvider router={router} />;

          return (
            <App/>
          );
        }`,
    );
    await runtimeConfigGenerator(tree, options);
    const mainTsxContent = tree
      .read('packages/test-app/src/main.tsx')
      ?.toString();
    expect(mainTsxContent).toMatchSnapshot('modified-main.tsx');
  });

  it('should skip generation if RuntimeConfig already exists', async () => {
    // Set up a basic React app structure
    tree.write(
      'packages/test-app/src/main.tsx',
      `import { RouterProvider } from '@tanstack/react-router';

        export function App() {
        
          const App = () => <RouterProvider router={router} />;

          return (
            <App/>
          );
        }`,
    );
    // First run to generate files
    await runtimeConfigGenerator(tree, options);
    // Get file content after first run
    const firstRunContent = tree
      .read('packages/test-app/src/components/RuntimeConfig/index.tsx')
      ?.toString();
    // Modify the file to simulate manual changes
    tree.write(
      'packages/test-app/src/components/RuntimeConfig/index.tsx',
      'modified content',
    );
    // Run generator again
    await runtimeConfigGenerator(tree, options);
    // Verify file wasn't overwritten
    expect(
      tree
        .read('packages/test-app/src/components/RuntimeConfig/index.tsx')
        ?.toString(),
    ).toBe('modified content');
    expect(
      tree
        .read('packages/test-app/src/components/RuntimeConfig/index.tsx')
        ?.toString(),
    ).not.toBe(firstRunContent);
  });

  it('should throw error if main.tsx does not exist', async () => {
    await expect(runtimeConfigGenerator(tree, options)).rejects.toThrow(
      'Can only run this generator on a project which contains packages/test-app/src/main.tsx',
    );
  });

  it('should throw error if App is not found', async () => {
    // Set up main.tsx without App
    tree.write(
      'packages/test-app/src/main.tsx',
      `export function App() {
        return <div>Test App</div>;
      }`,
    );
    await expect(runtimeConfigGenerator(tree, options)).rejects.toThrow(
      'Could not locate the App element in main.tsx',
    );
  });

  it('should generate shared constructs', async () => {
    // Set up a basic React app structure
    tree.write(
      'packages/test-app/src/main.tsx',
      `import { RouterProvider } from '@tanstack/react-router';

        export function App() {
        
          const App = () => <RouterProvider router={router} />;

          return (
            <App/>
          );
        }`,
    );
    await runtimeConfigGenerator(tree, options);
    // Check if shared constructs were generated
    expect(
      tree.exists('packages/common/constructs/src/core/index.ts'),
    ).toBeTruthy();
    expect(
      tree.exists('packages/common/constructs/src/core/runtime-config.ts'),
    ).toBeTruthy();
    // Snapshot the shared constructs files
    expect(
      tree.read('packages/common/constructs/src/core/index.ts')?.toString(),
    ).toMatchSnapshot('common/constructs-index.ts');
    expect(
      tree
        .read('packages/common/constructs/src/core/runtime-config.ts')
        ?.toString(),
    ).toMatchSnapshot('runtime-config.ts');
  });

  it('should add generator metric to app.ts', async () => {
    // Set up test tree with shared constructs
    await sharedConstructsGenerator(tree);

    // Set up a basic React app structure
    tree.write(
      'packages/test-app/src/main.tsx',
      `import { RouterProvider } from '@tanstack/react-router';

        export function App() {
        
          const App = () => <RouterProvider router={router} />;

          return (
            <App/>
          );
        }`,
    );

    // Call the generator function
    await runtimeConfigGenerator(tree, options);

    // Verify the metric was added to app.ts
    expectHasMetricTags(tree, RUNTIME_CONFIG_GENERATOR_INFO.metric);
  });
});
