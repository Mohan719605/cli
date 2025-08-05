import chalk from 'chalk';
import Table from 'cli-table3';
import { diffLines } from 'diff';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import { showDiffAndPromptJson } from './diffAndPromptJson';
import { showDiffAndPromptFile } from './diffAndPromptFile';


export async function showDiffAndPrompt(deliveryPath: string, devPath: string,relativePath: string) {
  const fileName = path.basename(deliveryPath);
  const isJson = fileName.endsWith('.json');

  const [oldRaw, newRaw] = await Promise.all([
    fs.readFile(deliveryPath, 'utf-8'),
    fs.readFile(devPath, 'utf-8'),
  ]);

  console.log(chalk.blue.bold(`\n📄 File: ${deliveryPath.replace(process.cwd(), '.')}`));

  if (isJson) {
   showDiffAndPromptJson(deliveryPath,devPath,relativePath)
  } else{
    await showDiffAndPromptFile(deliveryPath, devPath);
  }

  const { apply } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'apply',
      message: `Apply changes to ${chalk.yellow(deliveryPath.replace(process.cwd(), '.'))}?`,
      default: false,
    },
  ]);

  if (apply) {
    await fs.writeFile(deliveryPath, newRaw);
    console.log(chalk.green(`✅ Updated: ${deliveryPath}`));
  } else {
    console.log(chalk.yellow(`⏭️  Skipped: ${deliveryPath}`));
  }
}