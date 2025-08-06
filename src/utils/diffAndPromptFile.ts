import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import Table from "cli-table3";
import inquirer from "inquirer";
import {generateDiff,parseRange} from './HelperFunctions'




function readFileLines(filename: string): string[] {
  const content = fs.readFileSync(filename, "utf-8");
  return content.split(/\r?\n/);
}


export async function showDiffAndPromptFile(deliveryPath: string, devPath: string) {
  if (!fs.existsSync(deliveryPath) || !fs.existsSync(devPath)) {
    console.error(chalk.red("File(s) not found"));
    return;
  }
  let oldLines = readFileLines(deliveryPath);
  let newLines = readFileLines(devPath);
  
  const diffs = generateDiff(oldLines, newLines);


  const table = new Table({
    head: [
      chalk.bold.cyan.underline(path.basename(deliveryPath)),
      chalk.bold.cyan.underline(path.basename(devPath)),
    ],
    colWidths: [60, 60],
    style: { head: ["cyan"], border: ["grey"] },
    wordWrap: true,
  });

  const renderedMoves = new Set<string>();
  let oldLineNum = 1, newLineNum = 1;
  for (const chunk of diffs) {
    let leftText = "", rightText = "";
    switch (chunk.op) {
      case "equal":
        leftText = chalk.white(`${oldLineNum.toString().padStart(4)} | ${chunk.text}`);
        rightText = chalk.white(`${newLineNum.toString().padStart(4)} | ${chunk.text}`);
        oldLineNum++; newLineNum++; break;
      case "insert":
        leftText = "     ";
        rightText = chalk.green(`${newLineNum.toString().padStart(4)} | + ${chunk.text}`); newLineNum++; break;
      case "delete":
        leftText = chalk.red(`${oldLineNum.toString().padStart(4)} | - ${chunk.text}`);
        rightText = "     "; oldLineNum++; break;
      case "move":
        if (typeof chunk.fromIndex === "number" && typeof chunk.toIndex === "number") {
          const moveKey = `${chunk.text}|${chunk.fromIndex}->${chunk.toIndex}`;
          if (oldLineNum - 1 === chunk.fromIndex && !renderedMoves.has("old" + moveKey)) {
            leftText = chalk.bgCyan.black(`${oldLineNum.toString().padStart(4)} | - ${chunk.text} (moved to ${chunk.toIndex + 1})`);
            rightText = "     "; oldLineNum++; renderedMoves.add("old" + moveKey);
          } else if (newLineNum - 1 === chunk.toIndex && !renderedMoves.has("new" + moveKey)) {
            leftText = "     ";
            rightText = chalk.bgCyan.black(`${newLineNum.toString().padStart(4)} | + ${chunk.text} (moved from ${chunk.fromIndex + 1})`);
            newLineNum++; renderedMoves.add("new" + moveKey);
          }
        }
        break;
    }
    if (leftText.trim() || rightText.trim())
      table.push([leftText, rightText]);
  }

  console.log(chalk.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
  console.log(
    chalk.red("- Red = Removed, ") +
    chalk.green("+ Green = Added, ") +
    chalk.bgCyan.black(" Cyan = Moved ")
  );
  console.log(table.toString());

  interface EditAction {
  type: "insert" | "delete";
  deliveryAt?: number;
  devRange?: { start: number, end: number };
  deliveryRange?: { start: number, end: number };
}

const plannedEdits: EditAction[] = [];

while (true) {
  const { action } = await inquirer.prompt([
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
  if (action === "done") break;

  if (action === "insert") {
    const { deliveryAtStr } = await inquirer.prompt([
      {
        type: "input",
        name: "deliveryAtStr",
        message: "Insert BEFORE which delivery line number?",
        validate: (v) => /^\d+$/.test(v) && parseInt(v) > 0 ? true : "Enter a positive line number."
      }
    ]);
    const deliveryAt = parseInt(deliveryAtStr, 10);
    const { devRangeStr } = await inquirer.prompt([
      {
        type: "input",
        name: "devRangeStr",
        message: "Enter dev line number or range to insert (e.g. 5-8 or 10):",
        validate: v => !!parseRange(v) ? true : "Invalid range."
      }
    ]);
    plannedEdits.push({
      type: "insert",
      deliveryAt,
      devRange: parseRange(devRangeStr)!
    });
  }

  if (action === "delete") {
    const { deliveryRangeStr } = await inquirer.prompt([
      {
        type: "input",
        name: "deliveryRangeStr",
        message: "Enter delivery line number or range to delete (e.g. 2-4 or 7):",
        validate: v => !!parseRange(v) ? true : "Invalid range."
      }
    ]);
    plannedEdits.push({
      type: "delete",
      deliveryRange: parseRange(deliveryRangeStr)!
    });
  }
}

// Apply all actions, sort edits descending by affected delivery index to prevent index shifts
plannedEdits.sort((a, b) => {
  // For deletes/by start of range; for insert/by deliveryAt
  const indexA = a.type === "delete" ? a.deliveryRange!.start : a.deliveryAt!;
  const indexB = b.type === "delete" ? b.deliveryRange!.start : b.deliveryAt!;
  return indexB - indexA;
});

for (const edit of plannedEdits) {
  if (edit.type === "insert") {
    const toInsert = newLines.slice(edit.devRange!.start - 1, edit.devRange!.end);
    oldLines = [
      ...oldLines.slice(0, edit.deliveryAt! - 1),
      ...toInsert,
      ...oldLines.slice(edit.deliveryAt! - 1)
    ];
  }
  if (edit.type === "delete") {
    oldLines = [
      ...oldLines.slice(0, edit.deliveryRange!.start - 1),
      ...oldLines.slice(edit.deliveryRange!.end)
    ];
  }
}

// Preview result and confirm write
console.log(chalk.yellowBright("\nPreview of first 16 lines after patch:"));
console.log(oldLines.slice(0, 16).map((l,i) => chalk.gray(`${(i+1).toString().padStart(4)}:`) + l).join("\n"));
const { writeFile } = await inquirer.prompt([
  { type: "confirm", name: "writeFile", message: `Write patched version to delivery?`, default: false }
]);
if (writeFile) {
  await fs.promises.writeFile(deliveryPath, oldLines.join('\n'));
  console.log(chalk.green("✅ Patch written to disk."));
} else {
  console.log(chalk.yellow("No changes written."));
}
}