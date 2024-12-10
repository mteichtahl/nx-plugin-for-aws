
export interface ConfigureProjectOptions {
  /**
   * Full package name including scope (eg @foo/bar)
   */
  readonly fullyQualifiedName: string;
  /**
   * Directory of the project relative to the root
   */
  readonly dir: string;
}
