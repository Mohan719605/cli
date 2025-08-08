"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPrompt = showDiffAndPrompt;
const path_1 = __importDefault(require("path"));
const diffAndPromptJson_1 = require("./diffAndPromptJson");
const diffAndPromptFile_1 = require("./diffAndPromptFile");
const chalk_1 = __importDefault(require("chalk"));
async function showDiffAndPrompt(deliveryPath, devPath, relativePath) {
    const fileName = path_1.default.basename(deliveryPath);
    const isJson = fileName.endsWith('.json');
    console.log(chalk_1.default.cyan.bold(`\n🔍 Comparing file: ${relativePath} (Delivery ↔ Dev)\n`));
    if (isJson) {
        await (0, diffAndPromptJson_1.showDiffAndPromptJson)(deliveryPath, devPath, relativePath);
    }
    else {
        await (0, diffAndPromptFile_1.showDiffAndPromptFile)(deliveryPath, devPath);
    }
}
