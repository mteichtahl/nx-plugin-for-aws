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
} from '@nx/devkit';
import { TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema } from './schema';
import { sharedConstructsGenerator } from '../../utils/shared-constructs';
import { runtimeConfigGenerator } from '../runtime-config/generator';

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
  TYPE_DEFINITIONS_DIR,
} from '../../utils/shared-constructs-constants';
import {
  addStarExport,
  prependStatements,
  query,
  replace,
} from '../../utils/ast';
import { factory, SyntaxKind, InterfaceDeclaration } from 'typescript';

export const TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO: NxGeneratorInfo =
  getGeneratorInfo(__filename);

export const tsCloudscapeWebsiteVerifiedPermissionsGenerator = async (
  tree: Tree,
  options: TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema,
): Promise<GeneratorCallback> => {
  const principalEntityType = options.principalEntity;
  const namespace = options.namespace;

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

  await sharedConstructsGenerator(tree);
  await runtimeConfigGenerator(tree, {
    project: options.project,
  });

  // Add ICognitoProps interface and update IRuntimeConfig
  const runtimeConfigPath = joinPathFragments(
    PACKAGES_DIR,
    TYPE_DEFINITIONS_DIR,
    'src',
    'runtime-config.ts',
  );
  // Check if ICognitoProps interface exists
  const existingCognitoProps = query(
    tree,
    runtimeConfigPath,
    'InterfaceDeclaration[name.text="IVerifiedPermissionsProps"]',
  );
  // Check if cognitoProps property exists in IRuntimeConfig
  const existingCognitoPropsInConfig = query(
    tree,
    runtimeConfigPath,
    'InterfaceDeclaration[name.text="IRuntimeConfig"] PropertySignature[name.text="verifiedPermissionsProps"]',
  );

  // Add ICognitoProps interface if it doesn't exist
  if (existingCognitoProps.length === 0) {
    const cognitoPropsInterface = factory.createInterfaceDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      factory.createIdentifier('IVerifiedPermissionsProps'),
      undefined,
      undefined,
      [
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('namespace'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('policyStoreId'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
      ],
    );

    prependStatements(tree, runtimeConfigPath, [cognitoPropsInterface]);
  }

  // Add cognitoProps to IRuntimeConfig if it doesn't exist
  if (existingCognitoPropsInConfig.length === 0) {
    replace(
      tree,
      runtimeConfigPath,
      'InterfaceDeclaration[name.text="IRuntimeConfig"]',
      (node: InterfaceDeclaration) => {
        return factory.updateInterfaceDeclaration(
          node,
          node.modifiers,
          node.name,
          node.typeParameters,
          node.heritageClauses,
          [
            ...node.members,
            factory.createPropertySignature(
              undefined,
              factory.createIdentifier('verifiedPermissionsProps'),
              undefined,
              factory.createTypeReferenceNode(
                'IVerifiedPermissionsProps',
                undefined,
              ),
            ),
          ],
        );
      },
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

  await addGeneratorMetricsIfApplicable(tree, [
    TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO,
  ]);

  await formatFilesInSubtree(tree);
  return () => {
    installPackagesTask(tree);
  };
};

export default tsCloudscapeWebsiteVerifiedPermissionsGenerator;
