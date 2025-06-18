/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  joinPathFragments,
  generateFiles,
  Tree,
  OverwriteStrategy,
} from '@nx/devkit';
import { RuntimeConfigGeneratorSchema } from './schema';
import {
  factory,
  JsxSelfClosingElement,
  TypeAliasDeclaration,
  CallExpression,
  VariableDeclaration,
  SyntaxKind,
  NodeFlags,
  JsxAttribute,
  JsxAttributes,
  JsxExpression,
} from 'typescript';
import { sharedConstructsGenerator } from '../../utils/shared-constructs';
import { getNpmScopePrefix, toScopeAlias } from '../../utils/npm-scope';
import { formatFilesInSubtree } from '../../utils/format';
import {
  prependStatements,
  query,
  replaceIfExists,
  replace,
  addDestructuredImport,
} from '../../utils/ast';
import {
  NxGeneratorInfo,
  getGeneratorInfo,
  readProjectConfigurationUnqualified,
} from '../../utils/nx';
import { addGeneratorMetricsIfApplicable } from '../../utils/metrics';

export const RUNTIME_CONFIG_GENERATOR_INFO: NxGeneratorInfo =
  getGeneratorInfo(__filename);

export async function runtimeConfigGenerator(
  tree: Tree,
  options: RuntimeConfigGeneratorSchema,
) {
  const srcRoot = readProjectConfigurationUnqualified(
    tree,
    options.project,
  ).sourceRoot;
  const mainTsxPath = joinPathFragments(srcRoot, 'main.tsx');
  if (!tree.exists(mainTsxPath)) {
    throw new Error(
      `Can only run this generator on a project which contains ${mainTsxPath}`,
    );
  }

  const runtimeConfigPath = joinPathFragments(
    srcRoot,
    'components',
    'RuntimeConfig',
    'index.tsx',
  );
  if (
    tree.exists(runtimeConfigPath) ||
    query(
      tree,
      mainTsxPath,
      'JsxElement > JsxOpeningElement[name.text="RuntimeConfigProvider"]',
    ).length > 0
  ) {
    console.debug('Runtime config already exists, skipping generation');
    return;
  }

  await sharedConstructsGenerator(tree);

  const npmScopePrefix = getNpmScopePrefix(tree);
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', 'app'),
    srcRoot,
    {
      ...options,
      npmScopePrefix,
      scopeAlias: toScopeAlias(npmScopePrefix),
    },
    {
      overwriteStrategy: OverwriteStrategy.KeepExisting,
    },
  );
  const runtimeContextImport = factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      factory.createIdentifier('RuntimeConfigProvider'),
      undefined,
    ),
    factory.createStringLiteral('./components/RuntimeConfig', true),
  );

  prependStatements(tree, mainTsxPath, [runtimeContextImport]);

  let locatedTargetNode = false;
  replaceIfExists(
    tree,
    mainTsxPath,
    'JsxSelfClosingElement',
    (node: JsxSelfClosingElement) => {
      if (node.tagName.getText() !== 'App') {
        return node;
      } else {
        locatedTargetNode = true;
      }
      return factory.createJsxElement(
        factory.createJsxOpeningElement(
          factory.createIdentifier('RuntimeConfigProvider'),
          undefined,
          factory.createJsxAttributes([]),
        ),
        [node],
        factory.createJsxClosingElement(
          factory.createIdentifier('RuntimeConfigProvider'),
        ),
      );
    },
  );

  if (!locatedTargetNode) {
    throw new Error('Could not locate the App element in main.tsx');
  }

  // Add useRuntimeConfig import
  addDestructuredImport(
    tree,
    mainTsxPath,
    ['useRuntimeConfig'],
    './hooks/useRuntimeConfig',
  );

  // Update RouterProviderContext interface to include runtimeConfig (if it exists)
  const existingRouterProviderContext = query(
    tree,
    mainTsxPath,
    'TypeAliasDeclaration[name.text="RouterProviderContext"]',
  );

  if (existingRouterProviderContext.length > 0) {
    replace(
      tree,
      mainTsxPath,
      'TypeAliasDeclaration[name.text="RouterProviderContext"]',
      (node: any) => {
        // Check if runtimeConfig property already exists
        const existingType = node.type;
        if (existingType && existingType.members) {
          const hasRuntimeConfig = existingType.members.some(
            (member: any) =>
              member.name && member.name.text === 'runtimeConfig',
          );

          if (!hasRuntimeConfig) {
            const newMembers = [
              ...existingType.members,
              factory.createPropertySignature(
                undefined,
                factory.createIdentifier('runtimeConfig'),
                factory.createToken(SyntaxKind.QuestionToken),
                factory.createUnionTypeNode([
                  factory.createTypeReferenceNode(
                    factory.createIdentifier('ReturnType'),
                    [
                      factory.createTypeQueryNode(
                        factory.createIdentifier('useRuntimeConfig'),
                      ),
                    ],
                  ),
                  factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword),
                ]),
              ),
            ];

            return factory.createTypeAliasDeclaration(
              node.modifiers,
              factory.createIdentifier('RouterProviderContext'),
              undefined,
              factory.createTypeLiteralNode(newMembers),
            );
          }
        }
        return node;
      },
    );
  }

  // Update router context to include runtimeConfig property (if createRouter exists)
  const existingCreateRouter = query(
    tree,
    mainTsxPath,
    'CallExpression[expression.name="createRouter"]',
  );

  if (existingCreateRouter.length > 0) {
    replace(
      tree,
      mainTsxPath,
      'CallExpression[expression.name="createRouter"]',
      (node: any) => {
        const existingArg = node.arguments[0];

        // Check if runtimeConfig property already exists in context
        const hasRuntimeConfig = existingArg.properties.some(
          (prop: any) =>
            prop.name &&
            prop.name.text === 'context' &&
            prop.initializer &&
            prop.initializer.properties &&
            prop.initializer.properties.some(
              (contextProp: any) =>
                contextProp.name && contextProp.name.text === 'runtimeConfig',
            ),
        );

        if (!hasRuntimeConfig) {
          // Find or create context property
          const updatedProperties = existingArg.properties.map((prop: any) => {
            if (prop.name && prop.name.text === 'context') {
              // Add runtimeConfig to existing context
              const existingContextProps = prop.initializer.properties || [];
              const newContextProps = [
                ...existingContextProps,
                factory.createPropertyAssignment(
                  factory.createIdentifier('runtimeConfig'),
                  factory.createIdentifier('undefined'),
                ),
              ];

              return factory.createPropertyAssignment(
                factory.createIdentifier('context'),
                factory.createObjectLiteralExpression(newContextProps, true),
              );
            }
            return prop;
          });

          // If context property doesn't exist, add it
          const hasContext = existingArg.properties.some(
            (prop: any) => prop.name && prop.name.text === 'context',
          );

          if (!hasContext) {
            updatedProperties.push(
              factory.createPropertyAssignment(
                factory.createIdentifier('context'),
                factory.createObjectLiteralExpression(
                  [
                    factory.createPropertyAssignment(
                      factory.createIdentifier('runtimeConfig'),
                      factory.createIdentifier('undefined'),
                    ),
                  ],
                  true,
                ),
              ),
            );
          }

          return factory.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            [factory.createObjectLiteralExpression(updatedProperties, true)],
          );
        }

        return node;
      },
    );
  }

  // Update App component to use runtimeConfig in RouterProvider context (if App exists)
  const existingApp = query(
    tree,
    mainTsxPath,
    'VariableDeclaration[name.text="App"]',
  );

  if (existingApp.length > 0) {
    replace(
      tree,
      mainTsxPath,
      'VariableDeclaration[name.text="App"]',
      (node: any) => {
        const arrowFunction = node.initializer;

        // Check if it's already a block function with useRuntimeConfig
        if (arrowFunction.body.kind === SyntaxKind.Block) {
          const statements = arrowFunction.body.statements;
          const hasRuntimeConfigHook = statements.some(
            (stmt: any) =>
              stmt.kind === SyntaxKind.VariableStatement &&
              stmt.declarationList.declarations.some(
                (decl: any) => decl.name.text === 'runtimeConfig',
              ),
          );

          if (hasRuntimeConfigHook) {
            return node; // Already has runtimeConfig hook
          }
        }

        // Create new App component with runtimeConfig hook
        const newArrowFunction = factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          factory.createToken(SyntaxKind.EqualsGreaterThanToken),
          factory.createBlock(
            [
              // const runtimeConfig = useRuntimeConfig();
              factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                  [
                    factory.createVariableDeclaration(
                      factory.createIdentifier('runtimeConfig'),
                      undefined,
                      undefined,
                      factory.createCallExpression(
                        factory.createIdentifier('useRuntimeConfig'),
                        undefined,
                        [],
                      ),
                    ),
                  ],
                  NodeFlags.Const,
                ),
              ),
              // return <RouterProvider router={router} context={{ runtimeConfig }} />;
              factory.createReturnStatement(
                factory.createJsxSelfClosingElement(
                  factory.createIdentifier('RouterProvider'),
                  undefined,
                  factory.createJsxAttributes([
                    factory.createJsxAttribute(
                      factory.createIdentifier('router'),
                      factory.createJsxExpression(
                        undefined,
                        factory.createIdentifier('router'),
                      ),
                    ),
                    factory.createJsxAttribute(
                      factory.createIdentifier('context'),
                      factory.createJsxExpression(
                        undefined,
                        factory.createObjectLiteralExpression(
                          [
                            factory.createShorthandPropertyAssignment(
                              factory.createIdentifier('runtimeConfig'),
                            ),
                          ],
                          false,
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ],
            true,
          ),
        );

        return factory.updateVariableDeclaration(
          node,
          node.name,
          node.exclamationToken,
          node.type,
          newArrowFunction,
        );
      },
    );
  }

  await addGeneratorMetricsIfApplicable(tree, [RUNTIME_CONFIG_GENERATOR_INFO]);

  // Clean up duplicate ESLint disable comments
  const mainTsxContent = tree.read(mainTsxPath).toString();
  const cleanedContent = mainTsxContent.replace(
    /(\/\/ eslint-disable-next-line @typescript-eslint\/no-empty-object-type\s*\n)+/g,
    '// eslint-disable-next-line @typescript-eslint/no-empty-object-type\n',
  );

  if (cleanedContent !== mainTsxContent) {
    tree.write(mainTsxPath, cleanedContent);
  }

  await formatFilesInSubtree(tree);
}
export default runtimeConfigGenerator;
