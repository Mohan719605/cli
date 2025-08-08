
import path from 'path';
import { showDiffAndPromptJson } from './diffAndPromptJson';
import { showDiffAndPromptFile } from './diffAndPromptFile';
import chalk from 'chalk';


export async function showDiffAndPrompt(deliveryPath: string, devPath: string,relativePath: string) {
  const fileName = path.basename(deliveryPath);
  const isJson = fileName.endsWith('.json');
    console.log(chalk.cyan.bold(`\n🔍 Comparing file: ${relativePath} (Delivery ↔ Dev)\n`));
  if (isJson) {
   await showDiffAndPromptJson(deliveryPath,devPath,relativePath);
  } else{
    await showDiffAndPromptFile(deliveryPath, devPath);
  }

}