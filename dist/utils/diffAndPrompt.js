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
        const table = new cli_table3_1.default({
            head: [chalk_1.default.gray('Key'), chalk_1.default.gray('Delivery'), chalk_1.default.gray('Dev')],
            colWidths: [25, 30, 30],
            wordWrap: true,
        });
        for (const key of Array.from(allKeys)) {
            const oldVal = oldJson[key];
            const newVal = newJson[key];
            const same = oldVal === newVal;
            table.push([
                key,
                same ? chalk_1.default.gray(oldVal) : chalk_1.default.red(oldVal ?? '-'),
                same ? chalk_1.default.gray(newVal) : chalk_1.default.green(newVal ?? '-'),
            ]);
        }
        console.log(table.toString());
    }
    else {
        const diff = (0, diff_1.diffLines)(oldRaw, newRaw);
        const table = new cli_table3_1.default({
            head: [chalk_1.default.gray('Delivery Repo'), chalk_1.default.gray('Dev Repo')],
            colWidths: [60, 60],
            wordWrap: true,
        });
        let left = '';
        let right = '';
        for (const part of diff) {
            const lines = part.value.trimEnd().split('\n');
            for (const line of lines) {
                if (part.added) {
                    table.push(['', chalk_1.default.green(`+ ${line}`)]);
                }
                else if (part.removed) {
                    table.push([chalk_1.default.red(`- ${line}`), '']);
                }
                else {
                    table.push([
                        chalk_1.default.gray(`  ${line}`),
                        chalk_1.default.gray(`  ${line}`),
                    ]);
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
