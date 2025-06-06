/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Tree } from '@nx/devkit';
import {
  tsCloudscapeWebsiteVerifiedPermissionsGenerator,
  TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO,
} from './generator';
import { createTreeUsingTsSolutionSetup } from '../../utils/test';
import { expectHasMetricTags } from '../../utils/metrics.spec';
import { sharedConstructsGenerator } from '../../utils/shared-constructs';
import { TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema } from './schema';

describe('ts#cloudscape-website#verified-permissions generator', () => {
  let tree: Tree;

  const options: TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema = {
    project: 'test-project',
    principalEntity: 'User',
    namespace: 'example',
  };

  beforeEach(() => {
    tree = createTreeUsingTsSolutionSetup();

    // Set up a mock project structure
    tree.write(
      'packages/test-project/project.json',
      JSON.stringify({
        name: 'test-project',
        sourceRoot: 'packages/test-project/src',
      }),
    );

    // Setup main.tsx with RuntimeConfigProvider
    tree.write(
      'packages/test-project/src/main.tsx',
      `
      import { RuntimeConfigProvider } from './components/RuntimeConfig';
      import { RouterProvider, createRouter } from '@tanstack/react-router';

      export function App() {
        return (
          <RuntimeConfigProvider>
            <CognitoAuth>
              <RouterProvider router={router} />
            </CognitoAuth>
          </RuntimeConfigProvider>
        );
      }
    `,
    );
  });

  it('should run successfully', async () => {
    await tsCloudscapeWebsiteVerifiedPermissionsGenerator(tree, options);

    // Verify core files are generated
    expect(
      tree.exists(
        'packages/common/constructs/src/core/verified-permissions/index.ts',
      ),
    ).toBeTruthy();

    // Verify utils files are generated
    expect(
      tree.exists(
        'packages/common/constructs/src/core/verified-permissions/utils/cedar-json-validator.ts',
      ),
    ).toBeTruthy();

    expect(
      tree.exists(
        'packages/common/constructs/src/core/verified-permissions/utils/validators.ts',
      ),
    ).toBeTruthy();
  });

  it('should add generator metric to app.ts', async () => {
    await sharedConstructsGenerator(tree);

    await tsCloudscapeWebsiteVerifiedPermissionsGenerator(tree, options);

    expectHasMetricTags(
      tree,
      TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO.metric,
    );
  });
});
