
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import fs from 'fs-extra';

function compareJsonObjects(oldObj: any, newObj: any): [string, string, string][] {
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const diff: [string, string, string][] = [];

  for (const key of keys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff.push([key, stringify(oldVal), stringify(newVal)]);
    }
  }

  return diff;
}

function stringify(val: any): string {
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  if (val === undefined) return '-';
  return String(val);
}

type Change = {
  section: string;
  key: string;
  newVal: any;
};

export async function showDiffAndPromptJson(deliveryPath: string, devPath: string, writePath: string) {
  const [oldRaw, newRaw] = await Promise.all([
    fs.readFile(deliveryPath, 'utf-8'),
    fs.readFile(devPath, 'utf-8'),
  ]);
  const oldJson = JSON.parse(oldRaw);
  const newJson = JSON.parse(newRaw);

  const allSections = new Set([...Object.keys(oldJson), ...Object.keys(newJson)]);
  const changesToApply: Change[] = [];

  for (const section of allSections) {
    const oldSection = oldJson[section];
    const newSection = newJson[section];

    const isObject =
      typeof oldSection === 'object' &&
      typeof newSection === 'object' &&
      !Array.isArray(oldSection) &&
      oldSection !== null &&
      newSection !== null;

    let diffs: [string, string, string][] = [];

    if (isObject) {
      diffs = compareJsonObjects(oldSection, newSection);
    } else if (oldSection !== newSection) {
      diffs = [[section, stringify(oldSection), stringify(newSection)]];
    } else {
      continue;
    }

    if (diffs.length === 0) continue;

    console.log(chalk.cyan.bold(`\n📦 ${isObject ? section : 'Top-Level Keys'}`));

    const table = new Table({
      head: [chalk.gray('Key'), chalk.gray('Delivery Repo'), chalk.gray('Dev Repo')],
      colWidths: [30, 30, 30],
      wordWrap: true,
    });

    for (const [key, oldVal, newVal] of diffs) {
      table.push([
        key,
        chalk.red(oldVal || '-'),
        chalk.green(newVal || '-'),
      ]);
    }

    console.log(table.toString());

const { selectedKeys } = await inquirer.prompt([
  {
    type: 'checkbox',
    name: 'selectedKeys',
    message: `Select keys to apply from ${isObject ? section : 'Top-Level'}:`,
    choices: diffs.map(([key]) => ({
      name: key,
      value: key,
      checked: true,
    })),
  },
]);


    for (const key of selectedKeys) {
      const newVal = isObject ? newSection[key] : newSection;
      changesToApply.push({ section, key, newVal });
    }
  }

  if (changesToApply.length === 0) {
    console.log(chalk.yellow('✅ No changes selected.'));
    return;
  }

  // Final review
const finalChoices = await inquirer.prompt([
  {
    type: 'checkbox',
    name: 'finalKeys',
    message: chalk.bold.yellow('\n🧾 Final Review: Select the keys you want to apply'),
    choices: changesToApply.map(({ section, key }) => ({
      name: chalk.cyan(section) + chalk.gray('.') + chalk.green(key),
      value: `${section}:::${key}`,
      checked: true,
    })),
    pageSize: 15, // optional: allows better scrolling for long lists
  },
]);


  const finalSet = new Set(finalChoices.finalKeys);

  const filteredChanges = changesToApply.filter(
    ({ section, key }) => finalSet.has(`${section}:::${key}`)
  );

  if (filteredChanges.length === 0) {
    console.log(chalk.red('❌ All changes were deselected. Aborting write.'));
    return;
  }

  for (const { section, key, newVal } of filteredChanges) {
    const isObject = typeof oldJson[section] === 'object' && oldJson[section] !== null;

    if (isObject) {
      if (!oldJson[section]) oldJson[section] = {};
      oldJson[section][key] = newVal;
    } else {
      oldJson[section] = newVal;
    }
  }

  const { confirmWrite } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmWrite',
      message: `Do you want to write these ${filteredChanges.length} change(s) to ${writePath}?`,
      default: true,
    },
  ]);

  if (confirmWrite) {
    await fs.writeJson(writePath, oldJson, { spaces: 2 });
    console.log(chalk.green(`✅ Updated ${writePath}`));
  } else {
    console.log(chalk.red('❌ Changes discarded.'));
  }
}
