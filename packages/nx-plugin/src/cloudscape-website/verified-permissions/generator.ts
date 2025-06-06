/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GeneratorCallback,
  OverwriteStrategy,
  Tree,
  addDependenciesToPackageJson,
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
  addSingleImport,
  addStarExport,
  createJsxElement,
  createJsxElementFromIdentifier,
  prependStatements,
  query,
  replace,
} from '../../utils/ast';
import {
  factory,
  SyntaxKind,
  InterfaceDeclaration,
  JsxElement,
} from 'typescript';
import { withVersions } from '../../utils/versions';

export const TS_CLOUDSCAPE_WEBSITE_VERIFIED_PERMISSIONS_GENERATOR_INFO: NxGeneratorInfo =
  getGeneratorInfo(__filename);

export const tsCloudscapeWebsiteVerifiedPermissionsGenerator = async (
  tree: Tree,
  options: TsCloudscapeWebsiteVerifiedPermissionsGeneratorSchema,
): Promise<GeneratorCallback> => {
  const templateValues = {
    namespace: options.namespace,
    principalEntityType: options.principalEntity,
    groupEntity: options.groupEntity,
  };

  const appRoot = readProjectConfigurationUnqualified(
    tree,
    options.project,
  ).sourceRoot;

  const sourceSharedTemplates = joinPathFragments(
    __dirname,
    'files',
    SHARED_CONSTRUCTS_DIR,
    'src',
    'core',
    'verified-permissions',
  );
  const sharedDestinationPath = joinPathFragments(
    PACKAGES_DIR,
    SHARED_CONSTRUCTS_DIR,
    'src',
    'core',
    'verified-permissions',
  );
  const appSharedTemplates = joinPathFragments(
    __dirname,
    'files',
    'app',
    'components',
    'VerifiedPermissions',
  );

  // Add ICognitoProps interface and update IRuntimeConfig
  const runtimeConfigPath = joinPathFragments(
    PACKAGES_DIR,
    TYPE_DEFINITIONS_DIR,
    'src',
    'runtime-config.ts',
  );

  await sharedConstructsGenerator(tree);
  await runtimeConfigGenerator(tree, {
    project: options.project,
  });

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

  generateFiles(
    tree,
    sourceSharedTemplates,
    sharedDestinationPath,
    templateValues,
    {
      overwriteStrategy: OverwriteStrategy.KeepExisting,
    },
  );

  // add exports for verified permissions
  addStarExport(
    tree,
    joinPathFragments(sharedDestinationPath, '..', 'index.ts'),
    './verified-permissions/index.js',
  );

  // copy over the files into the app
  generateFiles(
    tree,
    appSharedTemplates,
    joinPathFragments(appRoot, 'components/VerifiedPermissions'),
    options,
    {
      overwriteStrategy: OverwriteStrategy.KeepExisting,
    },
  );

  // install dependencies into- @aws-sdk/client-verifiedpermissions
  const addDependencies = addDependenciesToPackageJson(
    tree,
    {
      '@aws-sdk/client-verifiedpermissions': '^3.39.0',
      '@aws-sdk/credential-providers': '^3.39.0',
      '@tanstack/react-query': '^5.79.0',
    },
    {},
  );

  const mainTsxPath = joinPathFragments(appRoot, 'main.tsx');
  addSingleImport(
    tree,
    mainTsxPath,
    'VerifiedPermissions',
    './components/VerifiedPermissions',
  );

  replace(
    tree,
    mainTsxPath,
    'JsxElement[openingElement.tagName.name="CognitoAuth"]',
    (node: JsxElement) =>
      createJsxElement(
        node.openingElement,
        [createJsxElementFromIdentifier('VerifiedPermissions', node.children)],
        node.closingElement,
      ),
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
