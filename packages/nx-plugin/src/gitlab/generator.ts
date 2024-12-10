import { formatFiles, generateFiles, Tree, joinPathFragments } from '@nx/devkit';
import { GitlabGeneratorSchema } from './schema';

export async function gitlabGenerator(
  tree: Tree,
  options: GitlabGeneratorSchema
) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', options);
  await formatFiles(tree);
}

export default gitlabGenerator;
