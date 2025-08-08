#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const upgrade_1 = require("./commands/upgrade");
const program = new commander_1.Command();
program
    .command('upgrade')
    .description('Compare and upgrade files from dev repo to delivery repo')
    .requiredOption('--dev <path_or_git_url>', 'Path or Git URL to dev repo (required)')
    .option('--branch <branch>', 'Branch to clone from')
    .option('--tag <tag>', 'Tag to checkout after cloning')
    .option('--files <config.json_file_path>', 'Path to JSON file (e.g., config.json) containing the file list for upgrade')
    .action(upgrade_1.upgradeCommand);
program.parse();
