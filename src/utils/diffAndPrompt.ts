import chalk from 'chalk';
import Table from 'cli-table3';
import { diffLines } from 'diff';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
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
export async function showDiffAndPrompt(deliveryPath: string, devPath: string) {
  const fileName = path.basename(deliveryPath);
  const isJson = fileName.endsWith('.json');

  const [oldRaw, newRaw] = await Promise.all([
    fs.readFile(deliveryPath, 'utf-8'),
    fs.readFile(devPath, 'utf-8'),
  ]);

  console.log(chalk.blue.bold(`\n📄 File: ${deliveryPath.replace(process.cwd(), '.')}`));

  if (isJson) {
    const oldJson = JSON.parse(oldRaw);
    const newJson = JSON.parse(newRaw);

    const diffEntries = compareJsonObjects(oldJson.dependencies || {}, newJson.dependencies || {});

    const table = new Table({
      head: [chalk.gray('Package'), chalk.gray('Delivery Repo'), chalk.gray('Dev Repo')],
      colWidths: [25, 30, 30],
      wordWrap: true,
    });

    for (const [pkg, oldVal, newVal] of diffEntries) {
      const same = oldVal === newVal;
      table.push([
        pkg,
        same ? chalk.gray(oldVal) : chalk.red(oldVal || '-'),
        same ? chalk.gray(newVal) : chalk.green(newVal || '-'),
      ]);
    }

    console.log(table.toString());
  }
else {
    const diff = diffLines(oldRaw, newRaw);

    const table = new Table({
      head: [chalk.gray('Delivery Repo'), chalk.gray('Dev Repo')],
      colWidths: [60, 60],
      wordWrap: true,
    });

    let left = '';
    let right = '';

    for (const part of diff) {
      const lines = part.value.trimEnd().split('\n');

      for (const line of lines) {
        if (part.added) {
          table.push(['', chalk.green(`+ ${line}`)]);
        } else if (part.removed) {
          table.push([chalk.red(`- ${line}`), '']);
        } else {
          table.push([
            chalk.gray(`  ${line}`),
            chalk.gray(`  ${line}`),
          ]);
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



