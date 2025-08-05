"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeCommand = upgradeCommand;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const simple_git_1 = __importDefault(require("simple-git"));
const tmp_promise_1 = __importDefault(require("tmp-promise"));
const chalk_1 = __importDefault(require("chalk"));
const readline_1 = __importDefault(require("readline"));
const diffAndPrompt_1 = require("../utils/diffAndPrompt");
const diffAndPromptJson_1 = require("../utils/diffAndPromptJson");
// 🚫 Handle Ctrl+C gracefully
process.on("SIGINT", () => {
    console.log(chalk_1.default.redBright("\n\n🚫 Process interrupted by user (Ctrl+C)."));
    console.log(chalk_1.default.yellow("ℹ️  No changes were made. If you wish to upgrade, please run the command again.\n"));
    process.exit(0);
});
function isGitUrl(url) {
    return url.startsWith("http") || url.endsWith(".git");
}
function promptUser(question) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
        rl.on("SIGINT", () => {
            rl.close();
            console.log(chalk_1.default.redBright("\n\n🚫 Process interrupted during input (Ctrl+C)."));
            console.log(chalk_1.default.yellow("ℹ️  No changes were made. If you wish to upgrade, please run the command again.\n"));
            process.exit(0);
        });
    });
}
async function askRefType() {
    const choice = await promptUser(chalk_1.default.yellow(`❓ Do you want to specify:\n  1) Branch\n  2) Tag\n  3) Both\n  4) Use default branch\nEnter 1, 2, 3 or 4: `));
    let refType = "default";
    let branch;
    let tag;
    switch (choice.trim()) {
        case "1": {
            const switchToTag = await promptUser(chalk_1.default.yellow("❓ Do you want to choose tag instead? (y/n): "));
            if (switchToTag.toLowerCase() === "y") {
                tag = await promptUser(chalk_1.default.cyan("👉 Enter the tag name: "));
                refType = "tag";
            }
            else {
                branch = await promptUser(chalk_1.default.cyan("👉 Enter the branch name: "));
                const alsoTag = await promptUser(chalk_1.default.yellow("❓ Do you also want to specify a tag? (y/n): "));
                if (alsoTag.toLowerCase() === "y") {
                    tag = await promptUser(chalk_1.default.cyan("👉 Enter the tag name: "));
                    refType = "both";
                }
                else {
                    refType = "branch";
                }
            }
            break;
        }
        case "2": {
            const switchToBranch = await promptUser(chalk_1.default.yellow("❓ Do you want to choose branch instead? (y/n): "));
            if (switchToBranch.toLowerCase() === "y") {
                branch = await promptUser(chalk_1.default.cyan("👉 Enter the branch name: "));
                refType = "branch";
            }
            else {
                tag = await promptUser(chalk_1.default.cyan("👉 Enter the tag name: "));
                const alsoBranch = await promptUser(chalk_1.default.yellow("❓ Do you also want to specify a branch? (y/n): "));
                if (alsoBranch.toLowerCase() === "y") {
                    branch = await promptUser(chalk_1.default.cyan("👉 Enter the branch name: "));
                    refType = "both";
                }
                else {
                    refType = "tag";
                }
            }
            break;
        }
        case "3": {
            branch = await promptUser(chalk_1.default.cyan("👉 Enter the branch name: "));
            tag = await promptUser(chalk_1.default.cyan("👉 Enter the tag name: "));
            refType = "both";
            break;
        }
        case "4":
        default:
            refType = "default";
    }
    return { refType, branch, tag };
}
async function upgradeCommand(opts) {
    if (!opts.dev) {
        console.error("❌ Please provide --dev <path_or_git_url>");
        process.exit(1);
    }
    if (!opts.files) {
        console.error("❌ Please provide --files <comma_separated_paths>");
        process.exit(1);
    }
    let devRepoPath = "";
    let ref = "";
    let tag = undefined;
    let refType = "default";
    if (isGitUrl(opts.dev)) {
        const temp = await tmp_promise_1.default.dir({ unsafeCleanup: true });
        const git = (0, simple_git_1.default)();
        let cloned = false;
        // Use CLI input if available
        if (opts.branch && opts.tag) {
            refType = "both";
            ref = opts.branch;
            tag = opts.tag;
        }
        else if (opts.branch) {
            refType = "branch";
            ref = opts.branch;
        }
        else if (opts.tag) {
            refType = "tag";
            ref = opts.tag;
        }
        while (!cloned) {
            if (!ref) {
                const result = await askRefType();
                refType = result.refType;
                ref = result.branch || result.tag || "";
                tag = result.refType === "both" ? result.tag : undefined;
                if (refType === "tag") {
                    tag = result.tag;
                    if (typeof tag === "string") {
                        ref = tag;
                    }
                    else {
                        console.error(chalk_1.default.red("❌ No valid tag provided. Aborting."));
                        process.exit(1);
                    }
                }
                if (refType === "default") {
                    console.log(chalk_1.default.greenBright("✅ Proceeding with default branch."));
                }
            }
            const cloneOptions = ["--depth", "1"];
            if (ref)
                cloneOptions.push("--branch", ref);
            console.log(`📥 Cloning ${opts.dev}...`);
            if (refType === "branch") {
                console.log(`🔀 Using branch: ${chalk_1.default.cyan(ref)}`);
            }
            else if (refType === "tag") {
                console.log(`🏷️  Using tag: ${chalk_1.default.cyan(ref)}`);
            }
            else if (refType === "both") {
                console.log(`🔀 Using branch: ${chalk_1.default.cyan(ref)} and then checking out tag...`);
            }
            try {
                await git.clone(opts.dev, temp.path, cloneOptions);
                if (refType === "both" && tag) {
                    const localGit = (0, simple_git_1.default)(temp.path);
                    await localGit.checkout(tag);
                    console.log(chalk_1.default.green(`🏷️  Checked out tag: ${chalk_1.default.cyan(tag)}`));
                }
                devRepoPath = temp.path;
                cloned = true;
            }
            catch (err) {
                const label = refType === "branch"
                    ? `branch "${ref}"`
                    : refType === "tag"
                        ? `tag "${ref}"`
                        : refType === "both"
                            ? `branch "${ref}" and tag "${tag}"`
                            : "default branch";
                console.error(chalk_1.default.red(`❌ Failed to clone with ${label}`));
                if (err instanceof Error) {
                    console.error(chalk_1.default.gray(`⛔ ${err.message.split("\n")[0]}`));
                }
                else {
                    console.error(chalk_1.default.gray("⛔ An unknown error occurred during cloning."));
                }
                const retry = await promptUser(chalk_1.default.yellow(`❓ The specified ${label} may not exist.\nWould you like to:\n  1) Enter new branch/tag\n  2) Use default branch\n  3) Abort\nEnter 1, 2, or 3: `));
                if (retry === "1") {
                    ref = "";
                    tag = undefined;
                }
                else if (retry === "2") {
                    ref = "";
                    tag = undefined;
                    refType = "default";
                }
                else {
                    console.error(chalk_1.default.red("❌ Aborted by user."));
                    process.exit(1);
                }
            }
        }
    }
    else {
        devRepoPath = path_1.default.resolve(opts.dev);
    }
    const deliveryRepo = process.cwd();
    const filePaths = opts.files.split(",").map((p) => p.trim());
    for (const relativePath of filePaths) {
        const devPath = path_1.default.join(devRepoPath, relativePath);
        const deliveryPath = path_1.default.join(deliveryRepo, relativePath);
        if ((await fs_extra_1.default.pathExists(devPath)) && (await fs_extra_1.default.pathExists(deliveryPath))) {
            const ext = path_1.default.extname(relativePath).toLowerCase();
            if (ext === ".json") {
                await (0, diffAndPromptJson_1.showDiffAndPromptJson)(deliveryPath, devPath, relativePath);
            }
            else {
                await (0, diffAndPrompt_1.showDiffAndPrompt)(deliveryPath, devPath, relativePath);
            }
        }
        else {
            console.warn(`⚠️  Missing file in one of the repos: ${chalk_1.default.yellow(relativePath)}`);
        }
    }
    console.log(chalk_1.default.green.bold("\n🎉 Upgrade process finished!"));
}
