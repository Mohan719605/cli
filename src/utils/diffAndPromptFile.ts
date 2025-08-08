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

  const { preview } = await inquirer.prompt([
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
          rightText = chalk.green(`${newLineNum.toString().padStart(4)} | + ${chunk.text}`);
          newLineNum++; break;
        case "delete":
          leftText = chalk.red(`${oldLineNum.toString().padStart(4)} | - ${chunk.text}`);
          rightText = "     ";
          oldLineNum++; break;
        case "move":
          if (typeof chunk.fromIndex === "number" && typeof chunk.toIndex === "number") {
            const moveKey = `${chunk.text}|${chunk.fromIndex}->${chunk.toIndex}`;
            if (oldLineNum - 1 === chunk.fromIndex && !renderedMoves.has("old" + moveKey)) {
              leftText = chalk.bgCyan.black(`${oldLineNum.toString().padStart(4)} | - ${chunk.text} (moved to ${chunk.toIndex + 1})`);
              rightText = "     ";
              oldLineNum++; renderedMoves.add("old" + moveKey);
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
console.log(chalk.gray(`📄 Comparing: ${deliveryPath} vs ${devPath}`));

    console.log(chalk.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
    console.log(
      chalk.red("- Red = Removed, ") +
      chalk.green("+ Green = Added, ") +
      chalk.bgCyan.black(" Cyan = Moved ")
    );
    console.log(table.toString());

    const { applyChanges } = await inquirer.prompt([
      {
        type: "confirm",
        name: "applyChanges",
        message: "Do you want to apply these changes (replace the file)?",
        default: false,
      },
    ]);

    if (applyChanges) {
      fs.copyFileSync(devPath, deliveryPath);
      console.log(chalk.green("✅ Changes applied successfully."));
    } else {
      console.log(chalk.yellow("⚠️ Changes not applied."));
    }
  } else {
    fs.copyFileSync(devPath, deliveryPath);
    console.log(chalk.green("✅ File replaced without preview."));
  }
}
