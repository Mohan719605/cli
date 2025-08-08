"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeCommand = upgradeCommand;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const diffAndPrompt_1 = require("../utils/diffAndPrompt");
const portalsListConfig_1 = require("../utils/portalsListConfig");
const selectGitRef_1 = require("../utils/selectGitRef");
const defaultFiles = [
    { name: "Next Config File", filename: "next.config.js" },
    { name: "Env File", filename: ".env" },
    { name: "Package File", filename: "package.json" },
    { name: "ts-config", filename: "tsconfig.json" },
    { name: "Docker File", filename: "Dockerfile" },
    { name: "Portal Registry", filename: "portal-registry.ts" },
];
function isGitUrl(url) {
    return url.startsWith("http") || url.endsWith(".git");
}
// Helper to load files array from package.json (or general JSON file path)
async function loadFilesFromJson(jsonFilePath) {
    if (!(await fs_extra_1.default.pathExists(jsonFilePath))) {
        console.error(chalk_1.default.red(`❌ File not found at: ${jsonFilePath}`));
        process.exit(1);
    }
    try {
        const content = await fs_extra_1.default.readFile(jsonFilePath, "utf-8");
        const json = JSON.parse(content);
        // Assuming file list is at json.upgradeFiles (adjust key as needed)
        if (!json.upgradeFiles || !Array.isArray(json.upgradeFiles)) {
            console.error(chalk_1.default.red(`❌ Missing or invalid 'upgradeFiles' array in ${jsonFilePath}`));
            process.exit(1);
        }
        // Validate array elements are strings
        if (!json.upgradeFiles.every((f) => typeof f === "string")) {
            console.error(chalk_1.default.red(`❌ 'upgradeFiles' should be an array of strings in ${jsonFilePath}`));
            process.exit(1);
        }
        return json.upgradeFiles;
    }
    catch (err) {
        console.error(chalk_1.default.red(`❌ Failed to parse JSON from ${jsonFilePath}: ${err.message}`));
        process.exit(1);
    }
}
async function upgradeCommand(opts) {
    if (!opts.dev) {
        console.error(chalk_1.default.red("❌ Please provide --dev <path_or_git_url>"));
        process.exit(1);
    }
    let selectedFiles = [];
    let devRepoPath = "";
    if (isGitUrl(opts.dev)) {
        devRepoPath = await (0, selectGitRef_1.cloneWithRef)({
            dev: opts.dev,
            branch: opts.branch,
            tag: opts.tag,
        });
    }
    else {
        devRepoPath = path_1.default.resolve(opts.dev);
    }
    const deliveryRepo = process.cwd();
    if (!opts.files) {
        console.log(chalk_1.default.bold.yellow("⚠️  No custom files were selected. Here are some default files — which one would you like to edit?"));
        const { selected } = await inquirer_1.default.prompt([
            {
                type: "checkbox",
                name: "selected",
                message: "Select files to compare and upgrade:",
                choices: defaultFiles.map((file) => ({
                    name: `${file.name} (${file.filename})`,
                    value: file.filename,
                    checked: true,
                })),
                validate: (input) => input.length > 0 || "Please select at least one file.",
            },
        ]);
        selectedFiles = selected;
        // For each selected file ask portal location and process
        for (const filename of selectedFiles) {
            const fileMeta = defaultFiles.find((f) => f.filename === filename);
            let finalPath = "";
            if (fileMeta) {
                const { selectedPortal } = await inquirer_1.default.prompt([
                    {
                        type: "list",
                        name: "selectedPortal",
                        message: `📂 Where is ${chalk_1.default.yellow(filename)} located?`,
                        choices: portalsListConfig_1.sharedPortals.map((p) => ({
                            name: `${p.label} (${path_1.default.join(p.basePath, filename)})`,
                            value: p.basePath,
                        })),
                    },
                ]);
                finalPath = path_1.default.join(selectedPortal, filename);
            }
            else {
                finalPath = filename;
            }
            const devPath = path_1.default.join(devRepoPath, finalPath);
            const deliveryPath = path_1.default.join(deliveryRepo, finalPath);
            if ((await fs_extra_1.default.pathExists(devPath)) &&
                (await fs_extra_1.default.pathExists(deliveryPath))) {
                await (0, diffAndPrompt_1.showDiffAndPrompt)(deliveryPath, devPath, finalPath);
            }
            else {
                console.warn(`⚠️  Missing file in one of the repos: ${chalk_1.default.yellow(finalPath)}`);
            }
        }
    }
    else {
        // --files option is provided:
        // Check if it's a direct file path or a config file with upgradeFiles array
        const filePath = path_1.default.isAbsolute(opts.files)
            ? opts.files
            : path_1.default.join(process.cwd(), opts.files);
        // Check if the file exists and if it's a direct file to upgrade vs config file
        if (await fs_extra_1.default.pathExists(filePath)) {
            try {
                const content = await fs_extra_1.default.readFile(filePath, "utf-8");
                const json = JSON.parse(content);
                // If it has upgradeFiles array, treat as config file
                if (json.upgradeFiles && Array.isArray(json.upgradeFiles)) {
                    selectedFiles = await loadFilesFromJson(filePath);
                    // Process files from config
                    for (const finalPath of selectedFiles) {
                        const devPath = path_1.default.join(devRepoPath, finalPath);
                        const deliveryPath = path_1.default.join(deliveryRepo, finalPath);
                        if ((await fs_extra_1.default.pathExists(devPath)) &&
                            (await fs_extra_1.default.pathExists(deliveryPath))) {
                            await (0, diffAndPrompt_1.showDiffAndPrompt)(deliveryPath, devPath, finalPath);
                        }
                        else {
                            console.warn(`⚠️  Missing file in one of the repos: ${chalk_1.default.yellow(finalPath)}`);
                        }
                    }
                }
                else {
                    // Treat as direct file to upgrade
                    const finalPath = opts.files;
                    const devPath = path_1.default.join(devRepoPath, finalPath);
                    const deliveryPath = path_1.default.join(deliveryRepo, finalPath);
                    if ((await fs_extra_1.default.pathExists(devPath)) &&
                        (await fs_extra_1.default.pathExists(deliveryPath))) {
                        await (0, diffAndPrompt_1.showDiffAndPrompt)(deliveryPath, devPath, finalPath);
                    }
                    else {
                        console.warn(`⚠️  Missing file in one of the repos: ${chalk_1.default.yellow(finalPath)}`);
                    }
                }
            }
            catch (err) {
                console.error(chalk_1.default.red(`❌ Failed to parse or process file ${filePath}: ${err.message}`));
                process.exit(1);
            }
        }
        else {
            console.error(chalk_1.default.red(`❌ File not found at: ${filePath}`));
            process.exit(1);
        }
    }
    console.log(chalk_1.default.green.bold("\n🎉 Upgrade process finished!"));
}
