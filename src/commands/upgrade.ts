import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import tmp from 'tmp-promise';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { showDiffAndPrompt } from '../utils/diffAndPrompt';

import { sharedPortals } from '../utils/portalsListConfig';

type UpgradeOptions = {
  dev?: string;
  files?: string;
};


const defaultFiles = [
  { name: 'Next Config File', filename: 'next.config.js' },
  { name: 'Env File', filename: '.env' },
  { name: 'Package File', filename: 'package.json' },
  { name: 'ts-config', filename: 'tsconfig.json' },
  {name : 'Docker File',filename :'Dockerfile'},
  {name :'Portal Registry',filename:'portal-registry.ts'}
];

function isGitUrl(url: string): boolean {
  return url.startsWith('http') || url.endsWith('.git');
}


export async function upgradeCommand(opts: UpgradeOptions) {
  if (!opts.dev) {
    console.error('❌ Please provide --dev <path_or_git_url>');
    process.exit(1);
  }

  let selectedFiles: string[];

  if (!opts.files) {
    // Ask User for default files
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select files to compare and upgrade:',
        choices: defaultFiles.map(file => ({
          name: file.name + ` (${file.filename})`,
          value: file.filename,
          checked: true,
        })),
        validate: input => input.length > 0 || 'Please select at least one file.',
      },
    ]);
    selectedFiles = selected;
  } else {
    selectedFiles = opts.files.split(',').map(f => f.trim());
  }

  // git/local clone
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

  for (const filename of selectedFiles) {
    const fileMeta = defaultFiles.find(f => f.filename === filename);

    let finalPath = '';
    if (fileMeta) {
      //portal selection
      const { selectedPortal } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedPortal',
          message: `📂 Where is ${chalk.yellow(filename)} located?`,
          choices: sharedPortals.map(p => ({
            name: `${p.label} (${path.join(p.basePath, filename)})`,
            value: p.basePath,
          })),
        },
      ]);

      finalPath = path.join(selectedPortal, filename);
    } else {
      finalPath = filename; 
    }

    const devPath = path.join(devRepoPath, finalPath);
    const deliveryPath = path.join(deliveryRepo, finalPath);

    if (await fs.pathExists(devPath) && await fs.pathExists(deliveryPath)) {
      await showDiffAndPrompt(deliveryPath, devPath, finalPath);
    } else {
      console.warn(`⚠️  Missing file in one of the repos: ${chalk.yellow(finalPath)}`);
    }
  }

  console.log(chalk.green.bold('\n🎉 Upgrade process finished!'));
}
