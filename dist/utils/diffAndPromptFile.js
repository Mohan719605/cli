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
// Read file lines (handles LF and CRLF)
function readFileLines(filename) {
    const content = fs.readFileSync(filename, "utf-8");
    return content.split(/\r?\n/);
}
//move detection with index mapping
function findMovesWithIndices(deleted, inserted) {
    const movesDel = [];
    const movesIns = [];
    const usedIns = new Set();
    for (const d of deleted) {
        for (const i of inserted) {
            if (!usedIns.has(i.idx) && d.text === i.text) {
                movesDel.push({ oldIdx: d.idx, newIdx: i.idx });
                movesIns.push({ oldIdx: d.idx, newIdx: i.idx });
                usedIns.add(i.idx);
                break;
            }
        }
    }
    return { movesDel, movesIns };
}
// LCS diff with move annotation (fromIndex, toIndex for moves)
function generateDiff(oldLines, newLines) {
    const diffs = [];
    const n = oldLines.length, m = newLines.length;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; --i) {
        for (let j = m - 1; j >= 0; --j) {
            dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    let i = 0, j = 0;
    const deleted = [];
    const inserted = [];
    const deletedIndices = [];
    const insertedIndices = [];
    while (i < n && j < m) {
        if (oldLines[i] === newLines[j]) {
            diffs.push({ op: "equal", text: oldLines[i] });
            i++;
            j++;
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            deleted.push({ text: oldLines[i], idx: i });
            deletedIndices.push(diffs.length);
            diffs.push({ op: "delete", text: oldLines[i], fromIndex: i });
            i++;
        }
        else {
            inserted.push({ text: newLines[j], idx: j });
            insertedIndices.push(diffs.length);
            diffs.push({ op: "insert", text: newLines[j], toIndex: j });
            j++;
        }
    }
    while (i < n) {
        deleted.push({ text: oldLines[i], idx: i });
        deletedIndices.push(diffs.length);
        diffs.push({ op: "delete", text: oldLines[i], fromIndex: i });
        i++;
    }
    while (j < m) {
        inserted.push({ text: newLines[j], idx: j });
        insertedIndices.push(diffs.length);
        diffs.push({ op: "insert", text: newLines[j], toIndex: j });
        j++;
    }
    // Mark moves with fromIndex/toIndex so we can show correct line numbers for both
    const { movesDel, movesIns } = findMovesWithIndices(deleted, inserted);
    for (const move of movesDel) {
        const dPos = deletedIndices[deleted.findIndex(x => x.idx === move.oldIdx)];
        diffs[dPos].op = "move";
        diffs[dPos].moved = true;
        diffs[dPos].fromIndex = move.oldIdx;
        diffs[dPos].toIndex = move.newIdx;
    }
    for (const move of movesIns) {
        const iPos = insertedIndices[inserted.findIndex(x => x.idx === move.newIdx)];
        diffs[iPos].op = "move";
        diffs[iPos].moved = true;
        diffs[iPos].fromIndex = move.oldIdx;
        diffs[iPos].toIndex = move.newIdx;
    }
    return diffs;
}
// Main function to show diff and prompt user
async function showDiffAndPromptFile(deliveryPath, devPath) {
    if (!fs.existsSync(deliveryPath) || !fs.existsSync(devPath)) {
        console.error(chalk_1.default.red("File(s) not found"));
        return;
    }
    const oldLines = readFileLines(deliveryPath);
    const newLines = readFileLines(devPath);
    const diffs = generateDiff(oldLines, newLines);
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.bold.cyan.underline(path.basename(deliveryPath)),
            chalk_1.default.bold.cyan.underline(path.basename(devPath))
        ],
        colWidths: [60, 60],
        style: {
            head: ["cyan"],
            border: ["grey"]
        },
        wordWrap: true,
    });
    // For mapping of which moves we've already rendered
    const renderedMoves = new Set();
    let oldLineNum = 1;
    let newLineNum = 1;
    for (const chunk of diffs) {
        let leftText = "";
        let rightText = "";
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
                // Only show each move once per appearance per side
                if (typeof chunk.fromIndex === "number" && typeof chunk.toIndex === "number") {
                    // Create a unique move key for this line content and locations
                    const moveKey = `${chunk.text}|${chunk.fromIndex}->${chunk.toIndex}`;
                    // Old file side: show move origin (moved to X)
                    if (oldLineNum - 1 === chunk.fromIndex && !renderedMoves.has("old" + moveKey)) {
                        leftText = chalk_1.default.bgCyan.black(`${oldLineNum.toString().padStart(4)} | - ${chunk.text} (moved to ${chunk.toIndex + 1})`);
                        rightText = "     ";
                        oldLineNum++;
                        renderedMoves.add("old" + moveKey);
                    }
                    // New file side: show move destination (moved from Y)
                    else if (newLineNum - 1 === chunk.toIndex && !renderedMoves.has("new" + moveKey)) {
                        leftText = "     ";
                        rightText = chalk_1.default.bgCyan.black(`${newLineNum.toString().padStart(4)} | + ${chunk.text} (moved from ${chunk.fromIndex + 1})`);
                        newLineNum++;
                        renderedMoves.add("new" + moveKey);
                    }
                }
                break;
        }
        // Only push a row if at least one side is non-empty (avoid blank lines)
        if (leftText.trim() || rightText.trim()) {
            table.push([leftText, rightText]);
        }
    }
    console.log(chalk_1.default.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
    console.log(chalk_1.default.red("- Red = Removed, ") +
        chalk_1.default.green("+ Green = Added, ") +
        chalk_1.default.bgCyan.black(" Cyan = Moved "));
    console.log(table.toString());
}
