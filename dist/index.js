"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const upgrade_1 = require("./commands/upgrade");
const program = new commander_1.Command();
program
    .command('upgrade')
    .description('Compare and upgrade files from dev repo to delivery repo')
    .option('--dev <path_or_git_url>', 'Path or Git URL to dev repo')
    .option('--files <comma_separated_paths>', 'Comma-separated list of files to compare')
    .action(upgrade_1.upgradeCommand);
program.parse();
