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

  if (opts.branch) {
    selectedRef = opts.branch;
    console.log(chalk.blue(`📦 Using branch '${selectedRef}'...`));
  } else if (opts.tag) {
    selectedRef = opts.tag;
    console.log(chalk.blue(`🏷️ Using tag '${selectedRef}'...`));
  } else {

    const { useDefault } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useDefault',
        message: `Do you want to clone the default 'develop' branch?`,
        default: true,
      },
    ]);

    if (!useDefault) {
      console.log(chalk.yellow('🛰️ Fetching remote refs...'));
      const remoteRefs = await git.listRemote(['--refs', opts.dev]);
      const branches = Array.from(remoteRefs.matchAll(/refs\/heads\/([^\n]+)/g)).map(m => m[1]);
      const tags = Array.from(remoteRefs.matchAll(/refs\/tags\/([^\n]+)/g)).map(m => m[1]);

      const { refType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'refType',
          message: '📂 Do you want to select a branch or a tag?',
          choices: ['branch', 'tag'],
        },
      ]);

      if (refType === 'branch') {
        const { selectedBranch } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedBranch',
            message: '🔀 Choose a branch to check out:',
            choices: branches.map(b => ({ name: b, value: b })),
          },
        ]);
        selectedRef = selectedBranch;
      } else {
        const { selectedTag } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTag',
            message: '🏷️ Choose a tag to check out:',
            choices: tags.map(t => ({ name: t, value: t })),
          },
        ]);
        selectedRef = selectedTag;
      }
    } else {
      console.log(chalk.green(`✅ Proceeding with default branch: '${selectedRef}'`));
    }
  }

  console.log(chalk.green(`📥 Cloning '${selectedRef}' from ${opts.dev} into temporary folder (auto-deleted)...`));
  await git.clone(opts.dev, repoPath, ['--branch', selectedRef, '--single-branch']);
  console.log(chalk.green('✅ Cloning completed.'));
  return repoPath;
}
