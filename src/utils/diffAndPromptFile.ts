
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import Table from "cli-table3";

type DiffOp = "equal" | "insert" | "delete" | "move";

interface DiffChunk {
  op: DiffOp;
  text: string;
  moved?: boolean;
  fromIndex?: number; 
  toIndex?: number;   
}

// Read file lines (handles LF and CRLF)
function readFileLines(filename: string): string[] {
  const content = fs.readFileSync(filename, "utf-8");
  return content.split(/\r?\n/);
}

//move detection with index mapping
function findMovesWithIndices(
  deleted: { text: string; idx: number }[],
  inserted: { text: string; idx: number }[]
): { movesDel: Array<{ oldIdx: number; newIdx: number }>, movesIns: Array<{ oldIdx: number; newIdx: number }> } {
  const movesDel: Array<{ oldIdx: number; newIdx: number }> = [];
  const movesIns: Array<{ oldIdx: number; newIdx: number }> = [];
  const usedIns = new Set<number>();
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
function generateDiff(oldLines: string[], newLines: string[]): DiffChunk[] {
  const diffs: DiffChunk[] = [];
  const n = oldLines.length,
    m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; --i) {
    for (let j = m - 1; j >= 0; --j) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0, j = 0;
  const deleted: { text: string, idx: number }[] = [];
  const inserted: { text: string, idx: number }[] = [];
  const deletedIndices: number[] = [];
  const insertedIndices: number[] = [];

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      diffs.push({ op: "equal", text: oldLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      deleted.push({ text: oldLines[i], idx: i });
      deletedIndices.push(diffs.length);
      diffs.push({ op: "delete", text: oldLines[i], fromIndex: i });
      i++;
    } else {
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


export async function showDiffAndPromptFile(deliveryPath: string, devPath: string) {
  if (!fs.existsSync(deliveryPath) || !fs.existsSync(devPath)) {
    console.error(chalk.red("File(s) not found"));
    return;
  }
  const oldLines = readFileLines(deliveryPath);
  const newLines = readFileLines(devPath);

  const diffs = generateDiff(oldLines, newLines);

  const table = new Table({
    head: [
      chalk.bold.cyan.underline(path.basename(deliveryPath)),
      chalk.bold.cyan.underline(path.basename(devPath))
    ],
    colWidths: [60, 60],
    style: {
      head: ["cyan"],
      border: ["grey"]
    },
    wordWrap: true,
  });

  // For mapping of which moves we've already rendered
  const renderedMoves = new Set<string>();

  let oldLineNum = 1;
  let newLineNum = 1;

  for (const chunk of diffs) {
    let leftText = "";
    let rightText = "";

    switch (chunk.op) {
      case "equal":
        leftText = chalk.white(`${oldLineNum.toString().padStart(4)} | ${chunk.text}`);
        rightText = chalk.white(`${newLineNum.toString().padStart(4)} | ${chunk.text}`);
        oldLineNum++;
        newLineNum++;
        break;

      case "insert":
        leftText = "     ";
        rightText = chalk.green(`${newLineNum.toString().padStart(4)} | + ${chunk.text}`);
        newLineNum++;
        break;

      case "delete":
        leftText = chalk.red(`${oldLineNum.toString().padStart(4)} | - ${chunk.text}`);
        rightText = "     ";
        oldLineNum++;
        break;

      case "move":
     
        if (typeof chunk.fromIndex === "number" && typeof chunk.toIndex === "number") {
  
          const moveKey = `${chunk.text}|${chunk.fromIndex}->${chunk.toIndex}`;

         
          if (oldLineNum - 1 === chunk.fromIndex && !renderedMoves.has("old"+moveKey)) {
            leftText = chalk.bgCyan.black(`${oldLineNum.toString().padStart(4)} | - ${chunk.text} (moved to ${chunk.toIndex + 1})`);
            rightText = "     ";
            oldLineNum++;
            renderedMoves.add("old"+moveKey);
          }
          
          else if (newLineNum - 1 === chunk.toIndex && !renderedMoves.has("new"+moveKey)) {
            leftText = "     ";
            rightText = chalk.bgCyan.black(`${newLineNum.toString().padStart(4)} | + ${chunk.text} (moved from ${chunk.fromIndex + 1})`);
            newLineNum++;
            renderedMoves.add("new"+moveKey);
          }
        }
        break;
    }

   
    if (leftText.trim() || rightText.trim()) {
      table.push([leftText, rightText]);
    }
  }

  console.log(chalk.bold.yellow("Diff Results (Old = deliveryPath, New = devPath)"));
  console.log(
    chalk.red("- Red = Removed, ") +
    chalk.green("+ Green = Added, ") +
    chalk.bgCyan.black(" Cyan = Moved ")
  );
  console.log(table.toString());


}
