/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  joinPathFragments,
  generateFiles,
  Tree,
  addDependenciesToPackageJson,
  installPackagesTask,
  OverwriteStrategy,
} from '@nx/devkit';
import { sharedConstructsGenerator } from '../../utils/shared-constructs';
import {
  TYPE_DEFINITIONS_DIR,
  PACKAGES_DIR,
  SHARED_CONSTRUCTS_DIR,
} from '../../utils/shared-constructs-constants';
import { TsCloudScapeWebsiteAuthGeneratorSchema as TsCloudScapeWebsiteAuthGeneratorSchema } from './schema';
import { runtimeConfigGenerator } from '../runtime-config/generator';
import {
  ArrowFunction,
  Block,
  factory,
  JsxElement,
  JsxSelfClosingElement,
  NodeFlags,
  SyntaxKind,
  VariableDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  CallExpression,
  JsxAttribute,
  JsxAttributes,
  JsxExpression,
} from 'typescript';
import { withVersions } from '../../utils/versions';
import {
  addStarExport,
  createJsxElement,
  createJsxElementFromIdentifier,
  addDestructuredImport,
  replace,
  addSingleImport,
  prependStatements,
  query,
} from '../../utils/ast';
import { formatFilesInSubtree } from '../../utils/format';
import {
  NxGeneratorInfo,
  getGeneratorInfo,
  readProjectConfigurationUnqualified,
} from '../../utils/nx';
import { addGeneratorMetricsIfApplicable } from '../../utils/metrics';

export const COGNITO_AUTH_GENERATOR_INFO: NxGeneratorInfo =
  getGeneratorInfo(__filename);

export async function tsCloudScapeWebsiteAuthGenerator(
  tree: Tree,
  options: TsCloudScapeWebsiteAuthGeneratorSchema,
) {
  const srcRoot = readProjectConfigurationUnqualified(
    tree,
    options.project,
  ).sourceRoot;
  if (
    tree.exists(joinPathFragments(srcRoot, 'components/CognitoAuth/index.tsx'))
  ) {
    throw new Error(
      `This generator has already been run on ${options.project}.`,
    );
  }

  await runtimeConfigGenerator(tree, {
    project: options.project,
  });

  await sharedConstructsGenerator(tree);
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
    'InterfaceDeclaration[name.text="ICognitoProps"]',
  );
  // Check if cognitoProps property exists in IRuntimeConfig
  const existingCognitoPropsInConfig = query(
    tree,
    runtimeConfigPath,
    'InterfaceDeclaration[name.text="IRuntimeConfig"] PropertySignature[name.text="cognitoProps"]',
  );

  // Add ICognitoProps interface if it doesn't exist
  if (existingCognitoProps.length === 0) {
    const cognitoPropsInterface = factory.createInterfaceDeclaration(
      [factory.createModifier(SyntaxKind.ExportKeyword)],
      factory.createIdentifier('ICognitoProps'),
      undefined,
      undefined,
      [
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('region'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('identityPoolId'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('userPoolId'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        ),
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier('userPoolWebClientId'),
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
              factory.createIdentifier('cognitoProps'),
              undefined,
              factory.createTypeReferenceNode('ICognitoProps', undefined),
            ),
          ],
        );
      },
    );
  }

  const identityPath = joinPathFragments(
    PACKAGES_DIR,
    SHARED_CONSTRUCTS_DIR,
    'src',
    'core',
    'user-identity.ts',
  );
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', 'app'),
    srcRoot,
    options,
    {
      overwriteStrategy: OverwriteStrategy.KeepExisting,
    },
  );
  if (!tree.exists(identityPath)) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files', SHARED_CONSTRUCTS_DIR),
      joinPathFragments(PACKAGES_DIR, SHARED_CONSTRUCTS_DIR),
      {
        allowSignup: options.allowSignup,
        cognitoDomain: options.cognitoDomain,
      },
      {
        overwriteStrategy: OverwriteStrategy.KeepExisting,
      },
    );
    addDependenciesToPackageJson(
      tree,
      withVersions(['oidc-client-ts', 'react-oidc-context']),
      {},
    );
    addStarExport(
      tree,
      joinPathFragments(
        PACKAGES_DIR,
        SHARED_CONSTRUCTS_DIR,
        'src',
        'core',
        'index.ts',
      ),
      './user-identity.js',
    );
  }
  const mainTsxPath = joinPathFragments(srcRoot, 'main.tsx');

  addSingleImport(tree, mainTsxPath, 'CognitoAuth', './components/CognitoAuth');
  addDestructuredImport(tree, mainTsxPath, ['useAuth'], 'react-oidc-context');

  // Update RouterProviderContext interface to include auth (if it exists)
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
        // Check if auth property already exists
        const existingType = node.type;
        if (existingType && existingType.members) {
          const hasAuth = existingType.members.some(
            (member: any) => member.name && member.name.text === 'auth',
          );

          if (!hasAuth) {
            const newMembers = [
              ...existingType.members,
              factory.createPropertySignature(
                undefined,
                factory.createIdentifier('auth'),
                factory.createToken(SyntaxKind.QuestionToken),
                factory.createUnionTypeNode([
                  factory.createTypeReferenceNode(
                    factory.createIdentifier('ReturnType'),
                    [
                      factory.createTypeQueryNode(
                        factory.createIdentifier('useAuth'),
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

  // Update router context to include auth property (if createRouter exists)
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

        // Check if auth property already exists in context
        const hasAuth = existingArg.properties.some(
          (prop: any) =>
            prop.name &&
            prop.name.text === 'context' &&
            prop.initializer &&
            prop.initializer.properties &&
            prop.initializer.properties.some(
              (contextProp: any) =>
                contextProp.name && contextProp.name.text === 'auth',
            ),
        );

        if (!hasAuth) {
          // Find or create context property
          const updatedProperties = existingArg.properties.map((prop: any) => {
            if (prop.name && prop.name.text === 'context') {
              // Add auth to existing context
              const existingContextProps = prop.initializer.properties || [];
              const newContextProps = [
                ...existingContextProps,
                factory.createPropertyAssignment(
                  factory.createIdentifier('auth'),
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
                      factory.createIdentifier('auth'),
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

  // Update App component to use auth in RouterProvider context
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

        // Check if it's already a block function with useAuth
        if (arrowFunction.body.kind === SyntaxKind.Block) {
          const statements = arrowFunction.body.statements;
          const hasAuthHook = statements.some(
            (stmt: any) =>
              stmt.kind === SyntaxKind.VariableStatement &&
              stmt.declarationList.declarations.some(
                (decl: any) => decl.name.text === 'auth',
              ),
          );

          if (hasAuthHook) {
            return node; // Already has auth hook
          }

          // Check if there's already a runtimeConfig hook
          const hasRuntimeConfigHook = statements.some(
            (stmt: any) =>
              stmt.kind === SyntaxKind.VariableStatement &&
              stmt.declarationList.declarations.some(
                (decl: any) => decl.name.text === 'runtimeConfig',
              ),
          );

          if (hasRuntimeConfigHook) {
            // Add auth hook and update RouterProvider context to include both
            const newStatements = [
              ...statements.slice(0, -1), // All statements except the return
              // Add const auth = useAuth();
              factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                  [
                    factory.createVariableDeclaration(
                      factory.createIdentifier('auth'),
                      undefined,
                      undefined,
                      factory.createCallExpression(
                        factory.createIdentifier('useAuth'),
                        undefined,
                        [],
                      ),
                    ),
                  ],
                  NodeFlags.Const,
                ),
              ),
              // Update return statement to include both runtimeConfig and auth
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
                            factory.createShorthandPropertyAssignment(
                              factory.createIdentifier('auth'),
                            ),
                          ],
                          false,
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ];

            return factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              node.type,
              factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                factory.createBlock(newStatements, true),
              ),
            );
          }
        }

        // Extract existing context properties from the original App component
        let existingContextProps = [];
        if (arrowFunction.body.kind === SyntaxKind.Block) {
          const statements = arrowFunction.body.statements;
          const returnStatement = statements.find(
            (stmt: any) => stmt.kind === SyntaxKind.ReturnStatement,
          );

          if (returnStatement && returnStatement.expression) {
            const jsxElement = returnStatement.expression;
            if (
              jsxElement.tagName &&
              jsxElement.tagName.text === 'RouterProvider'
            ) {
              const contextAttr = jsxElement.attributes.properties.find(
                (attr: any) => attr.name && attr.name.text === 'context',
              );

              if (
                contextAttr &&
                contextAttr.initializer &&
                contextAttr.initializer.expression
              ) {
                const contextObj = contextAttr.initializer.expression;
                if (contextObj.properties) {
                  existingContextProps = contextObj.properties;
                }
              }
            }
          }
        }

        // Create new App component with auth hook and preserve existing context
        const contextProps = [
          ...existingContextProps,
          factory.createShorthandPropertyAssignment(
            factory.createIdentifier('auth'),
          ),
        ];

        const newArrowFunction = factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          factory.createToken(SyntaxKind.EqualsGreaterThanToken),
          factory.createBlock(
            [
              // const auth = useAuth();
              factory.createVariableStatement(
                undefined,
                factory.createVariableDeclarationList(
                  [
                    factory.createVariableDeclaration(
                      factory.createIdentifier('auth'),
                      undefined,
                      undefined,
                      factory.createCallExpression(
                        factory.createIdentifier('useAuth'),
                        undefined,
                        [],
                      ),
                    ),
                  ],
                  NodeFlags.Const,
                ),
              ),
              // return <RouterProvider router={router} context={{ ...existingContext, auth }} />;
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
                          contextProps,
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

  replace(
    tree,
    mainTsxPath,
    'JsxElement[openingElement.tagName.name="RuntimeConfigProvider"]',
    (node: JsxElement) =>
      createJsxElement(
        node.openingElement,
        [createJsxElementFromIdentifier('CognitoAuth', node.children)],
        node.closingElement,
      ),
  );
  // Update App Layout
  const appLayoutTsxPath = joinPathFragments(
    srcRoot,
    'components',
    'AppLayout',
    'index.tsx',
  );
  if (tree.exists(appLayoutTsxPath)) {
    addDestructuredImport(
      tree,
      appLayoutTsxPath,
      ['useAuth'],
      'react-oidc-context',
    );
    replace(
      tree,
      appLayoutTsxPath,
      'VariableDeclaration',
      (node: VariableDeclaration) => {
        // Only process if this is the App component
        if (node.name.getText() !== 'AppLayout') {
          return node;
        }
        const arrowFunction = node.initializer as ArrowFunction;
        const functionBody = arrowFunction.body as Block;
        // Create our new declaration
        const authDeclaration = factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createObjectBindingPattern([
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier('user'),
                    undefined,
                  ),
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier('removeUser'),
                    undefined,
                  ),
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier('signoutRedirect'),
                    undefined,
                  ),
                  factory.createBindingElement(
                    undefined,
                    undefined,
                    factory.createIdentifier('clearStaleState'),
                    undefined,
                  ),
                ]),
                undefined,
                undefined,
                factory.createCallExpression(
                  factory.createIdentifier('useAuth'),
                  undefined,
                  [],
                ),
              ),
            ],
            NodeFlags.Const,
          ),
        );
        // Add as first statement
        const newStatements = [authDeclaration, ...functionBody.statements];
        // Create new arrow function with updated body
        const newArrowFunction = factory.updateArrowFunction(
          arrowFunction,
          arrowFunction.modifiers,
          arrowFunction.typeParameters,
          arrowFunction.parameters,
          arrowFunction.type,
          arrowFunction.equalsGreaterThanToken,
          factory.createBlock(newStatements, true),
        );
        // Update the variable declaration
        return factory.updateVariableDeclaration(
          node,
          node.name,
          node.exclamationToken,
          node.type,
          newArrowFunction,
        );
      },
    );
    // TODO: update utils if they exist by appending to the array
    replace(
      tree,
      appLayoutTsxPath,
      'JsxSelfClosingElement[tagName.text="TopNavigation"]',
      (node: JsxSelfClosingElement) => {
        // Create the utilities attribute
        const utilitiesAttribute = factory.createJsxAttribute(
          factory.createIdentifier('utilities'),
          factory.createJsxExpression(
            undefined,
            factory.createArrayLiteralExpression(
              [
                factory.createObjectLiteralExpression([
                  factory.createPropertyAssignment(
                    'type',
                    factory.createStringLiteral('menu-dropdown'),
                  ),
                  factory.createPropertyAssignment(
                    'text',
                    factory.createTemplateExpression(
                      factory.createTemplateHead(''),
                      [
                        factory.createTemplateSpan(
                          factory.createElementAccessChain(
                            factory.createPropertyAccessChain(
                              factory.createIdentifier('user'),
                              factory.createToken(SyntaxKind.QuestionDotToken),
                              factory.createIdentifier('profile'),
                            ),
                            factory.createToken(SyntaxKind.QuestionDotToken),
                            factory.createStringLiteral('cognito:username'),
                          ),
                          factory.createTemplateTail(''),
                        ),
                      ],
                    ),
                  ),
                  factory.createPropertyAssignment(
                    'iconName',
                    factory.createStringLiteral('user-profile-active'),
                  ),
                  factory.createPropertyAssignment(
                    'onItemClick',
                    factory.createArrowFunction(
                      undefined,
                      undefined,
                      [
                        factory.createParameterDeclaration(
                          undefined,
                          undefined,
                          factory.createIdentifier('e'),
                          undefined,
                          undefined,
                          undefined,
                        ),
                      ],
                      undefined,
                      factory.createToken(SyntaxKind.EqualsGreaterThanToken),
                      factory.createBlock(
                        [
                          factory.createIfStatement(
                            factory.createBinaryExpression(
                              factory.createPropertyAccessExpression(
                                factory.createPropertyAccessExpression(
                                  factory.createIdentifier('e'),
                                  factory.createIdentifier('detail'),
                                ),
                                factory.createIdentifier('id'),
                              ),
                              factory.createToken(
                                SyntaxKind.EqualsEqualsEqualsToken,
                              ),
                              factory.createStringLiteral('signout'),
                            ),
                            factory.createBlock(
                              [
                                factory.createExpressionStatement(
                                  factory.createCallExpression(
                                    factory.createIdentifier('removeUser'),
                                    undefined,
                                    [],
                                  ),
                                ),
                                factory.createExpressionStatement(
                                  factory.createCallExpression(
                                    factory.createIdentifier('signoutRedirect'),
                                    undefined,
                                    [
                                      factory.createObjectLiteralExpression([
                                        factory.createPropertyAssignment(
                                          'post_logout_redirect_uri',
                                          factory.createPropertyAccessExpression(
                                            factory.createPropertyAccessExpression(
                                              factory.createIdentifier(
                                                'window',
                                              ),
                                              factory.createIdentifier(
                                                'location',
                                              ),
                                            ),
                                            factory.createIdentifier('origin'),
                                          ),
                                        ),
                                        factory.createPropertyAssignment(
                                          'extraQueryParams',
                                          factory.createObjectLiteralExpression(
                                            [
                                              factory.createPropertyAssignment(
                                                'redirect_uri',
                                                factory.createPropertyAccessExpression(
                                                  factory.createPropertyAccessExpression(
                                                    factory.createIdentifier(
                                                      'window',
                                                    ),
                                                    factory.createIdentifier(
                                                      'location',
                                                    ),
                                                  ),
                                                  factory.createIdentifier(
                                                    'origin',
                                                  ),
                                                ),
                                              ),
                                              factory.createPropertyAssignment(
                                                'response_type',
                                                factory.createStringLiteral(
                                                  'code',
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ]),
                                    ],
                                  ),
                                ),
                                factory.createExpressionStatement(
                                  factory.createCallExpression(
                                    factory.createIdentifier('clearStaleState'),
                                    undefined,
                                    [],
                                  ),
                                ),
                              ],
                              true,
                            ),
                          ),
                        ],
                        true,
                      ),
                    ),
                  ),
                  factory.createPropertyAssignment(
                    'items',
                    factory.createArrayLiteralExpression([
                      factory.createObjectLiteralExpression([
                        factory.createPropertyAssignment(
                          'id',
                          factory.createStringLiteral('signout'),
                        ),
                        factory.createPropertyAssignment(
                          'text',
                          factory.createStringLiteral('Sign out'),
                        ),
                      ]),
                    ]),
                  ),
                ]),
              ],
              true,
            ),
          ),
        );
        // Add the utilities attribute to existing attributes
        return factory.createJsxSelfClosingElement(
          node.tagName,
          node.typeArguments,
          factory.createJsxAttributes([
            ...node.attributes.properties,
            utilitiesAttribute,
          ]),
        );
      },
    );
  } else {
    console.info(
      `Skipping update to ${appLayoutTsxPath} as it does not exist.`,
    );
  }
  // End update App Layout

  await addGeneratorMetricsIfApplicable(tree, [COGNITO_AUTH_GENERATOR_INFO]);

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
  return () => {
    installPackagesTask(tree);
  };
}
export default tsCloudScapeWebsiteAuthGenerator;
