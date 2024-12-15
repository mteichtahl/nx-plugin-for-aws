/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { getNpmScopePrefix, toScopeAlias } from './npm-scope';
import tsLibGenerator from '../ts/lib/generator';
import { withVersions } from './versions';

export const PACKAGES_DIR = 'packages';
export const TYPE_DEFINITIONS_NAME = 'common-types';
export const SHARED_CONSTRUCTS_NAME = 'common-constructs';
export const TYPE_DEFINITIONS_DIR = 'common/types';
export const SHARED_CONSTRUCTS_DIR = 'common/constructs';

export async function sharedConstructsGenerator(tree: Tree) {
  const npmScopePrefix = getNpmScopePrefix(tree);

  if (
    !tree.exists(
      joinPathFragments(PACKAGES_DIR, TYPE_DEFINITIONS_DIR, 'project.json')
    )
  ) {
    await tsLibGenerator(tree, {
      name: TYPE_DEFINITIONS_NAME,
      directory: PACKAGES_DIR,
      subDirectory: TYPE_DEFINITIONS_DIR,
      unitTestRunner: 'none',
    });

    tree.delete(joinPathFragments(PACKAGES_DIR, TYPE_DEFINITIONS_DIR, 'src'));

    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files', TYPE_DEFINITIONS_DIR),
      joinPathFragments(PACKAGES_DIR, TYPE_DEFINITIONS_DIR),
      {}
    );
  }

  if (
    !tree.exists(
      joinPathFragments(PACKAGES_DIR, SHARED_CONSTRUCTS_DIR, 'project.json')
    )
  ) {
    await tsLibGenerator(tree, {
      name: SHARED_CONSTRUCTS_NAME,
      directory: PACKAGES_DIR,
      subDirectory: SHARED_CONSTRUCTS_DIR,
      unitTestRunner: 'none',
    });

    tree.delete(joinPathFragments(PACKAGES_DIR, SHARED_CONSTRUCTS_DIR, 'src'));

    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files', SHARED_CONSTRUCTS_DIR),
      joinPathFragments(PACKAGES_DIR, SHARED_CONSTRUCTS_DIR),
      {
        npmScopePrefix,
        scopeAlias: toScopeAlias(npmScopePrefix),
      }
    );

    addDependenciesToPackageJson(
      tree,
      withVersions(['constructs', 'aws-cdk-lib']),
      {}
    );
  }
}
