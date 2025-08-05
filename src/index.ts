#!/usr/bin/env node
import { Command } from 'commander';
import { upgradeCommand } from './commands/upgrade';

const program = new Command();

program
  .command('upgrade')
  .description('Compare and upgrade files from dev repo to delivery repo')
  .option('--dev <path_or_git_url>', 'Path or Git URL to dev repo')
  .option('--files <comma_separated_paths>', 'Comma-separated list of files to compare')
  .action(upgradeCommand);

program.parse();


