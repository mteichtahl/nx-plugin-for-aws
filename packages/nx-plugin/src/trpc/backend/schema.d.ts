
export interface TrpcBackendGeneratorSchema {
  apiName: string;
  apiNamespace: string;
  bundler: TsLibGeneratorSchema['bundler'];
  directory?: TsLibGeneratorSchema['directory'];
  unitTestRunner: TsLibGeneratorSchema['unitTestRunner'];
}
