#!/usr/bin/env node
import { Command } from 'commander';
import { upgradeCommand } from './commands/upgrade';

const program = new Command();

program
  .command('upgrade')
  .description('Compare and upgrade files from dev repo to delivery repo')
  .requiredOption('--dev <path_or_git_url>', 'Path or Git URL to dev repo (required)')
  .option('--branch <branch>', 'Branch to clone from')
  .option('--tag <tag>', 'Tag to checkout after cloning')
  .option('--files <config.json_file_path>', 'Path to JSON file (e.g., config.json) containing the file list for upgrade')
  .action(upgradeCommand);

program.parse();
