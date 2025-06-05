/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GeneratorCallback,
  OverwriteStrategy,
  Tree,
  generateFiles,
  installPackagesTask,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema } from './schema';
import {
  NxGeneratorInfo,
  getGeneratorInfo,
  readProjectConfigurationUnqualified,
} from '../../utils/nx';
import { addGeneratorMetricsIfApplicable } from '../../utils/metrics';
import { formatFilesInSubtree } from '../../utils/format';
import {
  PACKAGES_DIR,
  SHARED_CONSTRUCTS_DIR,
} from '../../utils/shared-constructs-constants';
import { addStarExport } from '../../utils/ast';

export const TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO: NxGeneratorInfo =
  getGeneratorInfo(__filename);

export const tsCloudscapeWebsiteVerifiedPermissionsGenerator = async (
  tree: Tree,
  options: TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema,
): Promise<GeneratorCallback> => {
  const principalEntityType = options.principalEntity;
  const namespace = options.namespace;

  // principalEntityType?
  // cedarJsonSchema? (location - we should then load this in if not provided create an empty one)
  // validateCedarSchema?

  const srcRoot = readProjectConfigurationUnqualified(
    tree,
    options.project,
  ).sourceRoot;

  const sourceTemplates = joinPathFragments(
    __dirname,
    'files',
    SHARED_CONSTRUCTS_DIR,
    'src',
    'core',
    'verified-permissions',
  );
  const destinationPath = joinPathFragments(
    PACKAGES_DIR,
    SHARED_CONSTRUCTS_DIR,
    'src',
    'core',
    'verified-permissions',
  );
  const templateValues = {
    namespace,
    principalEntityType,
  };

  // Check if verified permission has already been generated
  const isGenerated = !tree.exists(
    joinPathFragments(destinationPath, 'index.ts'),
  );

  if (!isGenerated) {
    throw new Error(
      `Verified permissions have already been generated for ${options.project}. Please delete the existing verified permissions before generating new ones.`,
    );
  }

  generateFiles(tree, sourceTemplates, destinationPath, templateValues, {
    overwriteStrategy: OverwriteStrategy.KeepExisting,
  });

  addStarExport(
    tree,
    joinPathFragments(destinationPath, '..', 'index.ts'),
    './verified-permissions/index.js',
  );

  await formatFilesInSubtree(tree);

  await addGeneratorMetricsIfApplicable(tree, [
    TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO,
  ]);

  await formatFilesInSubtree(tree);
  return () => {
    installPackagesTask(tree);
  };
};

export default tsCloudscapeWebsiteVerifiedPermissionsGenerator;
