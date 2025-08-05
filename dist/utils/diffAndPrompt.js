"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPrompt = showDiffAndPrompt;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const inquirer_1 = __importDefault(require("inquirer"));
const path_1 = __importDefault(require("path"));
const diffAndPromptJson_1 = require("./diffAndPromptJson");
const diffAndPromptFile_1 = require("./diffAndPromptFile");
async function showDiffAndPrompt(deliveryPath, devPath, relativePath) {
    const fileName = path_1.default.basename(deliveryPath);
    const isJson = fileName.endsWith('.json');
    const [oldRaw, newRaw] = await Promise.all([
        fs_extra_1.default.readFile(deliveryPath, 'utf-8'),
        fs_extra_1.default.readFile(devPath, 'utf-8'),
    ]);
    console.log(chalk_1.default.blue.bold(`\n📄 File: ${deliveryPath.replace(process.cwd(), '.')}`));
    if (isJson) {
        (0, diffAndPromptJson_1.showDiffAndPromptJson)(deliveryPath, devPath, relativePath);
    }
    else {
        await (0, diffAndPromptFile_1.showDiffAndPromptFile)(deliveryPath, devPath);
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
