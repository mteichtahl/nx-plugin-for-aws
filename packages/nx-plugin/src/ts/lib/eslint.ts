/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  updateNxJson,
  readNxJson,
} from '@nx/devkit';
import { ConfigureProjectOptions } from './types';

export const configureEslint = (
  tree: Tree,
  options: ConfigureProjectOptions
) => {
  // Configure the lint task
  const projectConfiguration = readProjectConfiguration(
    tree,
    options.fullyQualifiedName
  );
  if (!projectConfiguration.targets.lint) {
    projectConfiguration.targets.lint = {
      executor: '@nx/eslint:lint',
      options: {
        fix: true,
      },
    };

    updateProjectConfiguration(
      tree,
      options.fullyQualifiedName,
      projectConfiguration
    );
  }

  const nxJson = readNxJson(tree);
  updateNxJson(tree, {
    ...nxJson,
    targetDefaults: {
      ...(nxJson.targetDefaults ?? {}),
      lint: {
        cache: true,
        inputs: [
          'default',
          '{workspaceRoot}/eslint.config.js',
          '{projectRoot}/eslint.config.js',
        ],
      },
    },
  });
};
