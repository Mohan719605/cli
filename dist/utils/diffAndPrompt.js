"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPrompt = showDiffAndPrompt;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const diff_1 = require("diff");
const fs_extra_1 = __importDefault(require("fs-extra"));
const inquirer_1 = __importDefault(require("inquirer"));
const path_1 = __importDefault(require("path"));
function compareJsonObjects(delivery, dev) {
    const keys = new Set([...Object.keys(delivery), ...Object.keys(dev)]);
    const result = [];
    for (const key of keys) {
        const oldVal = delivery[key] ?? '';
        const newVal = dev[key] ?? '';
        result.push([key, oldVal, newVal]);
    }
    return result;
}
async function showDiffAndPrompt(deliveryPath, devPath) {
    const fileName = path_1.default.basename(deliveryPath);
    const isJson = fileName.endsWith('.json');
    const [oldRaw, newRaw] = await Promise.all([
        fs_extra_1.default.readFile(deliveryPath, 'utf-8'),
        fs_extra_1.default.readFile(devPath, 'utf-8'),
    ]);
    console.log(chalk_1.default.blue.bold(`\n📄 File: ${deliveryPath.replace(process.cwd(), '.')}`));
    if (isJson) {
        const oldJson = JSON.parse(oldRaw);
        const newJson = JSON.parse(newRaw);
        const allKeys = new Set([...Object.keys(oldJson), ...Object.keys(newJson)]);
        for (const section of allKeys) {
            const oldSection = oldJson[section] ?? {};
            const newSection = newJson[section] ?? {};
            const isObject = typeof oldSection === 'object' &&
                typeof newSection === 'object' &&
                !Array.isArray(oldSection) &&
                !Array.isArray(newSection);
            if (!isObject)
                continue;
            const diffEntries = compareJsonObjects(oldSection, newSection).filter(([, oldVal, newVal]) => oldVal !== newVal);
            if (diffEntries.length === 0)
                continue;
            console.log(chalk_1.default.cyan.bold(`\n📦 ${section}`));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.gray('Key'), chalk_1.default.gray('Delivery Repo'), chalk_1.default.gray('Dev Repo')],
                colWidths: [30, 30, 50],
                wordWrap: true,
            });
            for (const [key, oldVal, newVal] of diffEntries) {
                const same = oldVal === newVal;
                table.push([
                    key,
                    same ? chalk_1.default.gray(oldVal) : chalk_1.default.red(oldVal || '-'),
                    same ? chalk_1.default.gray(newVal) : chalk_1.default.green(newVal || '-'),
                ]);
            }
            console.log(table.toString());
        }
    }
    else {
        const diff = (0, diff_1.diffLines)(oldRaw, newRaw);
        const table = new cli_table3_1.default({
            head: [chalk_1.default.gray('Removed from Delivery'), chalk_1.default.gray('Added in Dev')],
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
                    table.push(['', chalk_1.default.green(`+ ${line}`)]);
                }
                else if (part.removed) {
                    table.push([chalk_1.default.red(`- ${line}`), '']);
                }
            }
        }
        console.log(table.toString());
    }
    const { apply } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'apply',
            message: `Apply changes to ${chalk_1.default.yellow(deliveryPath.replace(process.cwd(), '.'))}?`,
            default: false,
        },
    ]);
    if (apply) {
        await fs_extra_1.default.writeFile(deliveryPath, newRaw);
        console.log(chalk_1.default.green(`✅ Updated: ${deliveryPath}`));
    }
    else {
        console.log(chalk_1.default.yellow(`⏭️  Skipped: ${deliveryPath}`));
    }
}
