import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import tmp from 'tmp-promise';
import chalk from 'chalk';
import { showDiffAndPrompt } from '../utils/diffAndPrompt';

function isGitUrl(url: string): boolean {
  return url.startsWith('http') || url.endsWith('.git');
}

type UpgradeOptions = {
  dev?: string;
  files?: string;
};

export async function upgradeCommand(opts: UpgradeOptions) {
  if (!opts.dev) {
    console.error('❌ Please provide --dev <path_or_git_url>');
    process.exit(1);
  }

  if (!opts.files) {
    console.error('❌ Please provide --files <comma_separated_paths>');
    process.exit(1);
  }


  let devRepoPath = '';
  if (isGitUrl(opts.dev)) {
    const temp = await tmp.dir({ unsafeCleanup: true });
    console.log(`📥 Cloning ${opts.dev}...`);
    await simpleGit().clone(opts.dev, temp.path);
    devRepoPath = temp.path;
  } else {
    devRepoPath = path.resolve(opts.dev);
  }

  const deliveryRepo = process.cwd();

  //  Split user file input
  const filePaths = opts.files.split(',').map(p => p.trim());

  for (const relativePath of filePaths) {
    const devPath = path.join(devRepoPath, relativePath);
    const deliveryPath = path.join(deliveryRepo, relativePath);

    if (await fs.pathExists(devPath) && await fs.pathExists(deliveryPath)) {
      await showDiffAndPrompt(deliveryPath, devPath);
    } else {
      console.warn(`⚠️  Missing file in one of the repos: ${chalk.yellow(relativePath)}`);
    }
  }

  console.log(chalk.green.bold('\n🎉 Upgrade process finished!'));
}
