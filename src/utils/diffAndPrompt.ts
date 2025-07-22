import chalk from 'chalk';
import Table from 'cli-table3';
import { diffLines } from 'diff';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import { showDiffAndPromptJson } from './diffAndPromptJson';

function compareJsonObjects(delivery: any, dev: any): [string, string, string][] {
  const keys = new Set([...Object.keys(delivery), ...Object.keys(dev)]);
  const result: [string, string, string][] = [];

  for (const key of keys) {
    const oldVal = delivery[key] ?? '';
    const newVal = dev[key] ?? '';
    result.push([key, oldVal, newVal]);
  }

  return result;
}

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
  } else {
    const diff = diffLines(oldRaw, newRaw);

  const table = new Table({
    head: [chalk.gray('Removed from Delivery'), chalk.gray('Added in Dev')],
    colWidths: [40, 60],
    wordWrap: true,
    style: {
      head: [],
      border: [],
    },
  });

  for (const part of diff) {
    const lines = part.value.trimEnd().split('\n');

    for (const line of lines) {
      if (part.added) {
        table.push(['', chalk.green(`+ ${line}`)]);
      } else if (part.removed) {
        table.push([chalk.red(`- ${line}`), '']);
      }
    }
  }

  console.log(table.toString());
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