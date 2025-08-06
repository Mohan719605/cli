type DiffOp = "equal" | "insert" | "delete" | "move";

interface DiffChunk {
  op: DiffOp;
  text: string;
  moved?: boolean;
  fromIndex?: number;
  toIndex?: number;
}


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
export function generateDiff(oldLines: string[], newLines: string[]): DiffChunk[] {
  const diffs: DiffChunk[] = [];
  const n = oldLines.length, m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; --i)
    for (let j = m - 1; j >= 0; --j)
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0;
  const deleted: { text: string, idx: number }[] = [], inserted: { text: string, idx: number }[] = [];
  const deletedIndices: number[] = [], insertedIndices: number[] = [];
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

export function parseRange(str: string): { start: number, end: number } | undefined {
  const match = str.trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return undefined;
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start;
  if (start > end) return undefined;
  return { start, end };
}
