/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
export interface InfraGeneratorSchema {
  name: string;
  directory?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  skipInstall?: boolean;
}
