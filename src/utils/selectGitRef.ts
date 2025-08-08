import inquirer from 'inquirer';
import simpleGit from 'simple-git';
import * as tmp from 'tmp-promise';
import chalk from 'chalk';

export interface CloneOptions {
  dev: string;
  branch?: string;
  tag?: string;
}

export async function cloneWithRef(opts: CloneOptions): Promise<string> {
  const git = simpleGit();
  const temp = await tmp.dir({ unsafeCleanup: true });
  const repoPath = temp.path;

  let selectedRef = 'develop';

  if (opts.branch && opts.tag) {
    console.log(chalk.red(`❌ You can't specify both --branch and --tag at the same time.`));
    process.exit(1);
  }

  if (opts.branch || opts.tag) {
    console.log(chalk.yellow('🛰️ Validating specified branch/tag in remote...'));
    const remoteRefs = await git.listRemote(['--refs', opts.dev]);

    const remoteBranches = Array.from(remoteRefs.matchAll(/refs\/heads\/([^\n]+)/g)).map(m => m[1]);
    const remoteTags = Array.from(remoteRefs.matchAll(/refs\/tags\/([^\n]+)/g)).map(m => m[1]);

    if (opts.branch) {
      selectedRef = opts.branch;
      if (!remoteBranches.includes(selectedRef)) {
        console.log(chalk.red(`❌ Branch '${selectedRef}' does not exist in remote.`));
        process.exit(1);
      }
      console.log(chalk.blue(`📦 Using branch '${selectedRef}'...`));
    }

    if (opts.tag) {
      selectedRef = opts.tag;
      if (!remoteTags.includes(selectedRef)) {
        console.log(chalk.red(`❌ Tag '${selectedRef}' does not exist in remote.`));
        process.exit(1);
      }
      console.log(chalk.blue(`🏷️ Using tag '${selectedRef}'...`));
    }
  } else {
    console.log(chalk.green(`✅ No branch or tag specified. Proceeding with default branch: '${selectedRef}'`));
  }

  console.log(chalk.green(`📥 Processing '${selectedRef}' from ${opts.dev}`));
  await git.clone(opts.dev, repoPath, ['--branch', selectedRef, '--single-branch']);
  console.log(chalk.green('✅ Processing completed.'));

  return repoPath;
}
