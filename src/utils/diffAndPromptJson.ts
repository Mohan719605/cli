import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import fs from 'fs-extra';

type Change = {
  section: string;
  key: string;
  newVal: any;
};
const excludeKeys = [
  "@sapiens-digital/sapiens-base-components",
  "@sapiens-digital/shared-components-kit",
 
];

function stringify(val: any): string {
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  if (val === undefined) return '-';
  return String(val);
}

function compareJsonObjects(oldObj: Record<string, any>, newObj: Record<string, any>): [string, string, string][] {
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

/**
 * Compare two dependency objects:
 * - Exclude @sapiens/* keys from diff
 * - Return diffs for other keys only
 */
function compareJsonObjectsFilter(
  oldDeps: Record<string, string>,
  newDeps: Record<string, string>
): [string, string, string][] {
  const diffs: [string, string, string][] = [];
  const keys = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]);
  
  for (const key of keys) {
     if (key.startsWith('@sapiens-digital/') && !excludeKeys.includes(key)) continue; // exclude sapiens in diffs

    const oldVal = oldDeps[key] ?? '-';
    const newVal = newDeps[key] ?? '-';
    if (oldVal !== newVal) {
      diffs.push([key, oldVal, newVal]);
    }
  }

  return diffs;
}

export async function showDiffAndPromptJson(deliveryPath: string, devPath: string, writePath: string) {
  const [oldRaw, newRaw] = await Promise.all([
    fs.readFile(deliveryPath, 'utf-8'),
    fs.readFile(devPath, 'utf-8'),
  ]);

  const oldJson = JSON.parse(oldRaw);
  const newJson = JSON.parse(newRaw);

  // Check if either file path ends with package.json (case-sensitive)
  const isPackageJson =
    deliveryPath.endsWith('package.json') || devPath.endsWith('package.json');

  const changesToApply: Change[] = [];

  if (isPackageJson) {
    const sectionsToCompare = ['dependencies', 'devDependencies'];

    for (const section of sectionsToCompare) {
      const oldDeps: Record<string, string> = oldJson[section] ?? {};
      const newDeps: Record<string, string> = newJson[section] ?? {};
      if (section === 'dependencies') {
        const sapiensKeys = Object.keys(oldDeps).filter((k) =>
  k.startsWith("@sapiens-digital/") && !excludeKeys.includes(k)
);
        // Determine default sapiens version from first sapiens dependency in newDeps, if any
        const defaultSapiensVersion: string | undefined = sapiensKeys.length > 0 ? oldDeps[sapiensKeys[0]] : undefined;

        let sapiensVersion: string | undefined;

        if (sapiensKeys.length > 0) {
          const answer = await inquirer.prompt<{ inputVersion: string }>([
            {
              type: 'input',
              name: 'inputVersion',
              message: `Enter version for all @sapiens dependencies (old-version: ${defaultSapiensVersion ?? 'keep old versions'}):`,
              default: defaultSapiensVersion ?? '',
            },
          ]);

          sapiensVersion = answer.inputVersion.trim() || undefined;

          console.log(
            chalk.magentaBright(
              `\n✨ All @sapiens dependencies will be updated to version: ${sapiensVersion ?? '[keeping old versions]'}`
            )
          );

          // Immediately add sapiens changes (without showing diff)
          for (const sapiensKey of sapiensKeys) {
            if (sapiensVersion) {
              changesToApply.push({
                section,
                key: sapiensKey,
                newVal: sapiensVersion,
              });
            }
            // else keep old version
          }
        }

        // Compare and prompt for non-sapiens dependencies only
        const diffs = compareJsonObjectsFilter(oldDeps, newDeps);

        if (diffs.length === 0 && sapiensKeys.length === 0) continue;

        if (diffs.length > 0) {
          console.log(chalk.cyan.bold(`\n📦 ${section}`));

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

          const { selectedKeys } = await inquirer.prompt<{ selectedKeys: string[] }>([
            {
              type: 'checkbox',
              name: 'selectedKeys',
              message: `Select keys to apply from ${section}:`,
              choices: diffs.map(([key]: [string, string, string]) => ({
                name: key,
                value: key,
                checked: true,
              })),
            },
          ]);

          for (const key of selectedKeys) {
            const newVal = newDeps[key];
            changesToApply.push({ section, key, newVal });
          }
        }
      } else {
        // For devDependencies just normal compare and prompt

        const diffs = compareJsonObjects(oldDeps, newDeps);

        if (diffs.length === 0) continue;

        console.log(chalk.cyan.bold(`\n📦 ${section}`));

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

        const { selectedKeys } = await inquirer.prompt<{ selectedKeys: string[] }>([
          {
            type: 'checkbox',
            name: 'selectedKeys',
            message: `Select keys to apply from ${section}:`,
            choices: diffs.map(([key]: [string, string, string]) => ({
              name: key,
              value: key,
              checked: true,
            })),
          },
        ]);

        for (const key of selectedKeys) {
          const newVal = newDeps[key];
          changesToApply.push({ section, key, newVal });
        }
      }
    }
  } else {
    // Non-package.json: compare all sections fully

    const allSections = new Set([...Object.keys(oldJson), ...Object.keys(newJson)]);

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
      } else if (JSON.stringify(oldSection) !== JSON.stringify(newSection)) {
        diffs = [[section, stringify(oldSection), stringify(newSection)]];
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

      const { selectedKeys } = await inquirer.prompt<{ selectedKeys: string[] }>([
        {
          type: 'checkbox',
          name: 'selectedKeys',
          message: `Select keys to apply from ${isObject ? section : 'Top-Level'}:`,
          choices: diffs.map(([key]: [string, string, string]) => ({
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
  }

  if (changesToApply.length === 0) {
    console.log(chalk.yellow('✅ No changes selected.'));
    return;
  }

  // Final review prompt
  const finalChoices = await inquirer.prompt<{
    finalKeys: string[];
  }>([
    {
      type: 'checkbox',
      name: 'finalKeys',
      message: chalk.bold.yellow('\n🧾 Final Review: Select the keys you want to apply'),
      choices: changesToApply.map(({ section, key }) => ({
        name: chalk.cyan(section) + chalk.gray('.') + chalk.green(key),
        value: `${section}:::${key}`,
        checked: true,
      })),
      pageSize: 15,
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

  // Apply changes into oldJson object
  for (const { section, key, newVal } of filteredChanges) {
    const isObject = typeof oldJson[section] === 'object' && oldJson[section] !== null;

    if (isObject) {
      if (!oldJson[section]) oldJson[section] = {};
      oldJson[section][key] = newVal;
    } else {
      oldJson[section] = newVal;
    }
  }

  // Confirm write
  const { confirmWrite } = await inquirer.prompt<{ confirmWrite: boolean }>([
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
