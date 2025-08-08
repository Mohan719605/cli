"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPromptFile = showDiffAndPromptFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const HelperFunctions_1 = require("./HelperFunctions");
function readFileLines(filename) {
    const content = fs.readFileSync(filename, "utf-8");
    return content.split(/\r?\n/);
}
async function showDiffAndPromptFile(deliveryPath, devPath) {
    if (!fs.existsSync(deliveryPath) || !fs.existsSync(devPath)) {
        console.error(chalk_1.default.red("File(s) not found"));
        return;
    }
    const { preview } = await inquirer_1.default.prompt([
        {
            type: "confirm",
            name: "preview",
            message: "Do you want to preview the changes before applying?",
            default: true,
        },
    ]);
    const oldLines = readFileLines(deliveryPath);
    const newLines = readFileLines(devPath);
    if (preview) {
        const diffs = (0, HelperFunctions_1.generateDiff)(oldLines, newLines);
        const table = new cli_table3_1.default({
            head: [
                chalk_1.default.bold.cyan.underline(path.basename(deliveryPath)),
                chalk_1.default.bold.cyan.underline(path.basename(devPath)),
            ],
            colWidths: [60, 60],
            style: { head: ["cyan"], border: ["grey"] },
            wordWrap: true,
        });
        const renderedMoves = new Set();
        let oldLineNum = 1, newLineNum = 1;
        for (const chunk of diffs) {
            let leftText = "", rightText = "";
            switch (chunk.op) {
                case "equal":
                    leftText = chalk_1.default.white(`${oldLineNum.toString().padStart(4)} | ${chunk.text}`);
                    rightText = chalk_1.default.white(`${newLineNum.toString().padStart(4)} | ${chunk.text}`);
                    oldLineNum++;
                    newLineNum++;
                    break;
                case "insert":
                    leftText = "     ";
                    rightText = chalk_1.default.green(`${newLineNum.toString().padStart(4)} | + ${chunk.text}`);
                    newLineNum++;
                    break;
                case "delete":
                    leftText = chalk_1.default.red(`${oldLineNum.toString().padStart(4)} | - ${chunk.text}`);
                    rightText = "     ";
                    oldLineNum++;
                    break;
                case "move":
                    if (typeof chunk.fromIndex === "number" && typeof chunk.toIndex === "number") {
                        const moveKey = `${chunk.text}|${chunk.fromIndex}->${chunk.toIndex}`;
                        if (oldLineNum - 1 === chunk.fromIndex && !renderedMoves.has("old" + moveKey)) {
                            leftText = chalk_1.default.bgCyan.black(`${oldLineNum.toString().padStart(4)} | - ${chunk.text} (moved to ${chunk.toIndex + 1})`);
                            rightText = "     ";
                            oldLineNum++;
                            renderedMoves.add("old" + moveKey);
                        }
                        else if (newLineNum - 1 === chunk.toIndex && !renderedMoves.has("new" + moveKey)) {
                            leftText = "     ";
                            rightText = chalk_1.default.bgCyan.black(`${newLineNum.toString().padStart(4)} | + ${chunk.text} (moved from ${chunk.fromIndex + 1})`);
                            newLineNum++;
                            renderedMoves.add("new" + moveKey);
                        }
                    }
                    break;
            }
            if (leftText.trim() || rightText.trim())
                table.push([leftText, rightText]);
        }
        console.log(chalk_1.default.gray(`📄 Comparing: ${deliveryPath} vs ${devPath}`));
        console.log(chalk_1.default.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
        console.log(chalk_1.default.red("- Red = Removed, ") +
            chalk_1.default.green("+ Green = Added, ") +
            chalk_1.default.bgCyan.black(" Cyan = Moved "));
        console.log(table.toString());
        const { applyChanges } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "applyChanges",
                message: "Do you want to apply these changes (replace the file)?",
                default: false,
            },
        ]);
        if (applyChanges) {
            fs.copyFileSync(devPath, deliveryPath);
            console.log(chalk_1.default.green("✅ Changes applied successfully."));
        }
        else {
            console.log(chalk_1.default.yellow("⚠️ Changes not applied."));
        }
    }
    else {
        fs.copyFileSync(devPath, deliveryPath);
        console.log(chalk_1.default.green("✅ File replaced without preview."));
    }
}
