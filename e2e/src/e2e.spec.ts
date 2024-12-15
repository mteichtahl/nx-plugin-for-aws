/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { runCLI, tmpProjPath } from './utils';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import { join } from 'path';
import { inject } from 'vitest';

describe('e2e tests', () => {
  beforeEach(() => {
    console.info('Cleaning target directory');
    if (existsSync(tmpProjPath())) {
      rmSync(tmpProjPath(), { force: true, recursive: true });
    }

    ensureDirSync(tmpProjPath());
  });

  it('should generate all packages and build successfully', async () => {
    runCLI(
      `pnpm dlx create-nx-workspace e2e-test --ci=skip --skipGit --preset=ts --interactive=false`,
      { prefixWithPackageManagerCmd: false, redirectStderr: true }
    );

    const opts = { cwd: `${tmpProjPath()}/e2e-test` };
    runCLI(
      `add http://localhost:4873/@aws/nx-plugin/-/nx-plugin-${inject(
        'publishedVersion'
      )}.tgz`,
      opts
    );
    runCLI(
      `generate @aws/nx-plugin:infra#app --name=infra --no-interactive`,
      opts
    );
    runCLI(
      `generate @aws/nx-plugin:cloudscape-website#app --name=website --projectNameAndRootFormat=as-provided --no-interactive`,
      opts
    );
    runCLI(
      `generate @aws/nx-plugin:trpc#backend --apiName=my-api --apiNamespace=@e2e-test --no-interactive`,
      opts
    );
    runCLI(
      `generate @aws/nx-plugin:cloudscape-website#cognito-auth --project=@e2e-test/website --no-interactive`,
      opts
    );
    runCLI(
      `generate @aws/nx-plugin:trpc#react --frontendProjectName=@e2e-test/website --backendProjectName=@e2e-test/my-api-backend --no-interactive`,
      opts
    );

    // Wire up website, cognito and trpc api
    writeFileSync(
      `${opts.cwd}/packages/infra/src/stacks/application-stack.ts`,
      readFileSync(join(__dirname, 'files/application-stack.ts.template'))
    );

    runCLI(`sync`, opts);
    runCLI(
      `run-many --target build --all --parallel 12 --output-style=stream`,
      opts
    );
  });
});
