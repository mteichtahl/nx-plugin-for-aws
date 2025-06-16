/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { TRPC_BACKEND_GENERATOR_INFO, tsTrpcApiGenerator } from './generator';
import {
  createTreeUsingTsSolutionSetup,
  snapshotTreeDir,
} from '../../utils/test';
import { expectHasMetricTags } from '../../utils/metrics.spec';

describe('trpc backend generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeUsingTsSolutionSetup();
  });

  it('should generate the project', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    // Verify project structure
    expect(tree.exists('apps/test-api')).toBeTruthy();

    // Verify generated files
    expect(tree.exists('apps/test-api/src/index.ts')).toBeTruthy();
    expect(tree.exists('apps/test-api/src/procedures')).toBeTruthy();
    expect(tree.exists('apps/test-api/src/schema')).toBeTruthy();

    // Create snapshots of generated files
    snapshotTreeDir(tree, 'apps/test-api/src');
  });

  it('should set up project configuration correctly', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });
    const backendProjectConfig = JSON.parse(
      tree.read('apps/test-api/project.json', 'utf-8'),
    );
    // Verify project metadata
    expect(backendProjectConfig.metadata).toEqual({
      apiName: 'TestApi',
      apiType: 'trpc',
      auth: 'IAM',
      generator: TRPC_BACKEND_GENERATOR_INFO.id,
      port: 2022,
    });
  });

  it('should add required dependencies', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });
    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    // Verify dependencies were added
    expect(packageJson.dependencies['@trpc/server']).toBeDefined();
    expect(packageJson.dependencies['zod']).toBeDefined();
    expect(packageJson.dependencies['aws-xray-sdk-core']).toBeDefined();
    expect(packageJson.dependencies['aws-cdk-lib']).toBeDefined();
    expect(packageJson.dependencies['constructs']).toBeDefined();
    expect(
      packageJson.dependencies['@aws-lambda-powertools/logger'],
    ).toBeDefined();
    expect(
      packageJson.dependencies['@aws-lambda-powertools/metrics'],
    ).toBeDefined();
    expect(
      packageJson.dependencies['@aws-lambda-powertools/tracer'],
    ).toBeDefined();
    expect(packageJson.devDependencies['@types/aws-lambda']).toBeDefined();
  });

  it('should set up shared constructs for http', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });
    // Verify shared constructs setup
    expect(
      tree.exists('packages/common/constructs/src/app/apis/index.ts'),
    ).toBeTruthy();
    expect(
      tree.exists('packages/common/constructs/src/app/apis/test-api.ts'),
    ).toBeTruthy();

    expect(
      tree.read('packages/common/constructs/src/app/apis/index.ts', 'utf-8'),
    ).toContain("export * from './test-api.js'");
    expect(
      tree.read('packages/common/constructs/src/app/index.ts', 'utf-8'),
    ).toContain("export * from './apis/index.js'");
    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toMatchSnapshot('test-api.ts');
    expect(
      tree.read('packages/common/constructs/src/core/api/http-api.ts', 'utf-8'),
    ).toMatchSnapshot('http-api.ts');
    expect(
      tree.read('packages/common/constructs/src/core/api/utils.ts', 'utf-8'),
    ).toMatchSnapshot('utils.ts');
    expect(
      tree.read(
        'packages/common/constructs/src/core/api/trpc-utils.ts',
        'utf-8',
      ),
    ).toMatchSnapshot('trpc-utils.ts');

    expect(
      tree.exists('packages/common/constructs/src/core/api/rest-api.ts'),
    ).toBeFalsy();
  });

  it('should set up shared constructs for rest', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayRestApi',
      auth: 'IAM',
    });
    // Verify shared constructs setup
    expect(
      tree.exists('packages/common/constructs/src/app/apis/index.ts'),
    ).toBeTruthy();
    expect(
      tree.exists('packages/common/constructs/src/app/apis/test-api.ts'),
    ).toBeTruthy();

    expect(
      tree.read('packages/common/constructs/src/app/apis/index.ts', 'utf-8'),
    ).toContain("export * from './test-api.js'");
    expect(
      tree.read('packages/common/constructs/src/app/index.ts', 'utf-8'),
    ).toContain("export * from './apis/index.js'");
    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toMatchSnapshot('test-api.ts');
    expect(
      tree.read('packages/common/constructs/src/core/api/rest-api.ts', 'utf-8'),
    ).toMatchSnapshot('rest-api.ts');
    expect(
      tree.read('packages/common/constructs/src/core/api/utils.ts', 'utf-8'),
    ).toMatchSnapshot('utils.ts');
    expect(
      tree.read(
        'packages/common/constructs/src/core/api/trpc-utils.ts',
        'utf-8',
      ),
    ).toMatchSnapshot('trpc-utils.ts');

    expect(
      tree.exists('packages/common/constructs/src/core/api/http-api.ts'),
    ).toBeFalsy();
  });

  it('should add a task for starting a local server', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });
    const projectConfig = readProjectConfiguration(tree, '@proj/test-api');
    expect(projectConfig.targets).toHaveProperty('serve');
    expect(projectConfig.targets!.serve!.executor).toBe('nx:run-commands');
    expect(projectConfig.targets!.serve!.options!.commands).toEqual([
      'tsx --watch src/local-server.ts',
    ]);
  });

  it('should add cors headers to the local server', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    const devDeps = readJson(tree, 'package.json').devDependencies;
    expect(devDeps).toHaveProperty('cors');
    expect(devDeps).toHaveProperty('@types/cors');

    expect(tree.exists('apps/test-api/src/local-server.ts')).toBeTruthy();
    expect(tree.read('apps/test-api/src/local-server.ts', 'utf-8')).toContain(
      'middleware: cors()',
    );
  });

  it('should add generator metric to app.ts', async () => {
    // Call the generator function
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    // Verify the metric was added to app.ts
    expectHasMetricTags(tree, TRPC_BACKEND_GENERATOR_INFO.metric);
  });

  it('should include CORS headers in router.ts when using REST API', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayRestApi',
      auth: 'IAM',
    });

    // Read the generated router.ts file
    const routerTsContent = tree.read('apps/test-api/src/router.ts', 'utf-8');

    // Verify CORS headers are included in responseMeta
    expect(routerTsContent).toContain('responseMeta: () => ({');
    expect(routerTsContent).toContain("'Access-Control-Allow-Origin': '*'");
    expect(routerTsContent).toContain("'Access-Control-Allow-Methods': '*'");
  });

  it('should generate with cognito auth for a REST API', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayRestApi',
      auth: 'Cognito',
    });
    snapshotTreeDir(tree, 'apps/test-api/src/client');
    snapshotTreeDir(tree, 'packages/common/constructs/src/app/apis');

    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toContain('CognitoUserPoolsAuthorizer');
  });

  it('should generate with cognito auth for an HTTP API', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'Cognito',
    });
    snapshotTreeDir(tree, 'apps/test-api/src/client');
    snapshotTreeDir(tree, 'packages/common/constructs/src/app/apis');

    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toContain('HttpUserPoolAuthorizer');
  });

  it('should generate with no auth for a REST API', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayRestApi',
      auth: 'None',
    });
    snapshotTreeDir(tree, 'apps/test-api/src/client');
    snapshotTreeDir(tree, 'packages/common/constructs/src/app/apis');

    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toContain('AuthorizationType.NONE');
  });

  it('should generate with no auth for an HTTP API', async () => {
    await tsTrpcApiGenerator(tree, {
      name: 'TestApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'None',
    });
    snapshotTreeDir(tree, 'apps/test-api/src/client');
    snapshotTreeDir(tree, 'packages/common/constructs/src/app/apis');

    expect(
      tree.read('packages/common/constructs/src/app/apis/test-api.ts', 'utf-8'),
    ).toContain('HttpNoneAuthorizer');
  });

  it('should increment ports when running generator multiple times', async () => {
    // Generate first API
    await tsTrpcApiGenerator(tree, {
      name: 'FirstApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    // Generate second API
    await tsTrpcApiGenerator(tree, {
      name: 'SecondApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    // Generate third API
    await tsTrpcApiGenerator(tree, {
      name: 'ThirdApi',
      directory: 'apps',
      computeType: 'ServerlessApiGatewayHttpApi',
      auth: 'IAM',
    });

    // Check metadata ports
    const firstApiConfig = JSON.parse(
      tree.read('apps/first-api/project.json', 'utf-8'),
    );
    const secondApiConfig = JSON.parse(
      tree.read('apps/second-api/project.json', 'utf-8'),
    );
    const thirdApiConfig = JSON.parse(
      tree.read('apps/third-api/project.json', 'utf-8'),
    );

    expect(firstApiConfig.metadata.port).toBe(2022);
    expect(secondApiConfig.metadata.port).toBe(2023);
    expect(thirdApiConfig.metadata.port).toBe(2024);

    // Check local-server.ts files contain correct ports
    const firstLocalServer = tree.read(
      'apps/first-api/src/local-server.ts',
      'utf-8',
    );
    const secondLocalServer = tree.read(
      'apps/second-api/src/local-server.ts',
      'utf-8',
    );
    const thirdLocalServer = tree.read(
      'apps/third-api/src/local-server.ts',
      'utf-8',
    );

    expect(firstLocalServer).toContain('const PORT = 2022;');
    expect(secondLocalServer).toContain('const PORT = 2023;');
    expect(thirdLocalServer).toContain('const PORT = 2024;');
  });
});
