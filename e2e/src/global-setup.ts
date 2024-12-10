import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { readJsonFile } from '@nx/devkit';
import { join } from 'path';
import { execSync } from 'child_process';

export default async function ({ provide }) {
  try {
    console.info('Starting local registry...');

    global.teardown = await startLocalRegistry({
      localRegistryTarget: '@aws/nx-plugin-source:local-registry',
      verbose: true,
      clearStorage: true,
    });

    console.info('Local registry started!');

    const publishedVersion = readJsonFile(
      join(__dirname, '../../dist/packages/nx-plugin/package.json')
    ).version;
    provide('publishedVersion', publishedVersion);
    console.info(
      `Publishing @aws/nx-plugin@${publishedVersion} to local registry\n`
    );

    try {
      execSync(`npm unpublish --force && npm publish --force`, {
        env: process.env,
        cwd: join(__dirname, '../../dist/packages/nx-plugin'),
      });
      console.info('Package published to local registry');
    } catch (err) {
      console.error(`Package couldn't be published to local registry: ${err}`);
    }
  } catch (err) {
    console.error(`Failed to start local registry: ${err}`);
    throw err;
  }

  return async () => {
    if (global.teardown) {
      console.info('Shutting down local registry...');
      global.teardown();
      console.info('Local registry shut down!');
    }
  };
}
