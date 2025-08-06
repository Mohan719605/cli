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
    let oldLines = readFileLines(deliveryPath);
    let newLines = readFileLines(devPath);
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
    console.log(chalk_1.default.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
    console.log(chalk_1.default.red("- Red = Removed, ") +
        chalk_1.default.green("+ Green = Added, ") +
        chalk_1.default.bgCyan.black(" Cyan = Moved "));
    console.log(table.toString());
    const plannedEdits = [];
    while (true) {
        const { action } = await inquirer_1.default.prompt([
            {
                type: "list",
                name: "action",
                message: "Choose operation to apply to delivery file:",
                choices: [
                    { name: "Insert lines from dev into delivery", value: "insert" },
                    { name: "Delete lines in delivery", value: "delete" },
                    { name: "Finish (write and exit)", value: "done" }
                ]
            }
        ]);
        if (action === "done")
            break;
        if (action === "insert") {
            const { deliveryAtStr } = await inquirer_1.default.prompt([
                {
                    type: "input",
                    name: "deliveryAtStr",
                    message: "Insert BEFORE which delivery line number?",
                    validate: (v) => /^\d+$/.test(v) && parseInt(v) > 0 ? true : "Enter a positive line number."
                }
            ]);
            const deliveryAt = parseInt(deliveryAtStr, 10);
            const { devRangeStr } = await inquirer_1.default.prompt([
                {
                    type: "input",
                    name: "devRangeStr",
                    message: "Enter dev line number or range to insert (e.g. 5-8 or 10):",
                    validate: v => !!(0, HelperFunctions_1.parseRange)(v) ? true : "Invalid range."
                }
            ]);
            plannedEdits.push({
                type: "insert",
                deliveryAt,
                devRange: (0, HelperFunctions_1.parseRange)(devRangeStr)
            });
        }
        if (action === "delete") {
            const { deliveryRangeStr } = await inquirer_1.default.prompt([
                {
                    type: "input",
                    name: "deliveryRangeStr",
                    message: "Enter delivery line number or range to delete (e.g. 2-4 or 7):",
                    validate: v => !!(0, HelperFunctions_1.parseRange)(v) ? true : "Invalid range."
                }
            ]);
            plannedEdits.push({
                type: "delete",
                deliveryRange: (0, HelperFunctions_1.parseRange)(deliveryRangeStr)
            });
        }
    }
    // Apply all actions, sort edits descending by affected delivery index to prevent index shifts
    plannedEdits.sort((a, b) => {
        // For deletes/by start of range; for insert/by deliveryAt
        const indexA = a.type === "delete" ? a.deliveryRange.start : a.deliveryAt;
        const indexB = b.type === "delete" ? b.deliveryRange.start : b.deliveryAt;
        return indexB - indexA;
    });
    for (const edit of plannedEdits) {
        if (edit.type === "insert") {
            const toInsert = newLines.slice(edit.devRange.start - 1, edit.devRange.end);
            oldLines = [
                ...oldLines.slice(0, edit.deliveryAt - 1),
                ...toInsert,
                ...oldLines.slice(edit.deliveryAt - 1)
            ];
        }
        if (edit.type === "delete") {
            oldLines = [
                ...oldLines.slice(0, edit.deliveryRange.start - 1),
                ...oldLines.slice(edit.deliveryRange.end)
            ];
        }
    }
    // Preview result and confirm write
    console.log(chalk_1.default.yellowBright("\nPreview of first 16 lines after patch:"));
    console.log(oldLines.slice(0, 16).map((l, i) => chalk_1.default.gray(`${(i + 1).toString().padStart(4)}:`) + l).join("\n"));
    const { writeFile } = await inquirer_1.default.prompt([
        { type: "confirm", name: "writeFile", message: `Write patched version to delivery?`, default: false }
    ]);
    if (writeFile) {
        await fs.promises.writeFile(deliveryPath, oldLines.join('\n'));
        console.log(chalk_1.default.green("✅ Patch written to disk."));
    }
    else {
        console.log(chalk_1.default.yellow("No changes written."));
    }
}
