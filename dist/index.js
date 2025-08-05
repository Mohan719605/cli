#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const upgrade_1 = require("./commands/upgrade");
const program = new commander_1.Command();
program
    .command("upgrade")
    .description("Compare and upgrade files from dev repo to delivery repo")
    .option("--dev <path_or_git_url>", "Path or Git URL to dev repo")
    .option("--files <comma_separated_paths>", "Comma-separated list of files to compare")
    .option("--branch <branch_name>", "Specify a branch to clone from (cannot be used with --tag)")
    .option("--tag <tag_name>", "Specify a tag to clone from (cannot be used with --branch)")
    .action(upgrade_1.upgradeCommand);
program.parse();
