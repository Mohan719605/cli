"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPromptJson = showDiffAndPromptJson;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_extra_1 = __importDefault(require("fs-extra"));
function compareJsonObjects(oldObj, newObj) {
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    const diff = [];
    for (const key of keys) {
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diff.push([key, stringify(oldVal), stringify(newVal)]);
        }
    }
    return diff;
}
function stringify(val) {
    if (typeof val === 'object' && val !== null)
        return JSON.stringify(val);
    if (val === undefined)
        return '-';
    return String(val);
}
async function showDiffAndPromptJson(deliveryPath, devPath, writePath) {
    const [oldRaw, newRaw] = await Promise.all([
        fs_extra_1.default.readFile(deliveryPath, 'utf-8'),
        fs_extra_1.default.readFile(devPath, 'utf-8'),
    ]);
    const oldJson = JSON.parse(oldRaw);
    const newJson = JSON.parse(newRaw);
    const allSections = new Set([...Object.keys(oldJson), ...Object.keys(newJson)]);
    const changesToApply = [];
    for (const section of allSections) {
        const oldSection = oldJson[section];
        const newSection = newJson[section];
        const isObject = typeof oldSection === 'object' &&
            typeof newSection === 'object' &&
            !Array.isArray(oldSection) &&
            oldSection !== null &&
            newSection !== null;
        let diffs = [];
        if (isObject) {
            diffs = compareJsonObjects(oldSection, newSection);
        }
        else if (oldSection !== newSection) {
            diffs = [[section, stringify(oldSection), stringify(newSection)]];
        }
        else {
            continue;
        }
        if (diffs.length === 0)
            continue;
        console.log(chalk_1.default.cyan.bold(`\n📦 ${isObject ? section : 'Top-Level Keys'}`));
        const table = new cli_table3_1.default({
            head: [chalk_1.default.gray('Key'), chalk_1.default.gray('Delivery Repo'), chalk_1.default.gray('Dev Repo')],
            colWidths: [30, 30, 30],
            wordWrap: true,
        });
        for (const [key, oldVal, newVal] of diffs) {
            table.push([
                key,
                chalk_1.default.red(oldVal || '-'),
                chalk_1.default.green(newVal || '-'),
            ]);
        }
        console.log(table.toString());
        const { selectedKeys } = await inquirer_1.default.prompt([
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
        console.log(chalk_1.default.yellow('✅ No changes selected.'));
        return;
    }
    // Final review
    const finalChoices = await inquirer_1.default.prompt([
        {
            type: 'checkbox',
            name: 'finalKeys',
            message: chalk_1.default.bold.yellow('\n🧾 Final Review: Select the keys you want to apply'),
            choices: changesToApply.map(({ section, key }) => ({
                name: chalk_1.default.cyan(section) + chalk_1.default.gray('.') + chalk_1.default.green(key),
                value: `${section}:::${key}`,
                checked: true,
            })),
            pageSize: 15, // optional: allows better scrolling for long lists
        },
    ]);
    const finalSet = new Set(finalChoices.finalKeys);
    const filteredChanges = changesToApply.filter(({ section, key }) => finalSet.has(`${section}:::${key}`));
    if (filteredChanges.length === 0) {
        console.log(chalk_1.default.red('❌ All changes were deselected. Aborting write.'));
        return;
    }
    for (const { section, key, newVal } of filteredChanges) {
        const isObject = typeof oldJson[section] === 'object' && oldJson[section] !== null;
        if (isObject) {
            if (!oldJson[section])
                oldJson[section] = {};
            oldJson[section][key] = newVal;
        }
        else {
            oldJson[section] = newVal;
        }
    }
    const { confirmWrite } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'confirmWrite',
            message: `Do you want to write these ${filteredChanges.length} change(s) to ${writePath}?`,
            default: true,
        },
    ]);
    if (confirmWrite) {
        await fs_extra_1.default.writeJson(writePath, oldJson, { spaces: 2 });
        console.log(chalk_1.default.green(`✅ Updated ${writePath}`));
    }
    else {
        console.log(chalk_1.default.red('❌ Changes discarded.'));
    }
}
