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
function isGitUrl(url) {
    return url.startsWith("http") || url.endsWith(".git");
}
function promptUser(question) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
    }));
}
async function askRefType() {
    const choice = await promptUser(chalk_1.default.yellow(`❓ Do you want to specify:\n  1) Branch\n  2) Tag\n  3) Both\n  4) Use default branch\nEnter 1, 2, 3 or 4: `));
    switch (choice.trim()) {
        case "1":
            return "branch";
        case "2":
            return "tag";
        case "3":
            return "both";
        case "4":
        default:
            return "default";
    }
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
    let ref = opts.ref;
    let tag;
    let refType = "default";
    if (isGitUrl(opts.dev)) {
        const temp = await tmp_promise_1.default.dir({ unsafeCleanup: true });
        const git = (0, simple_git_1.default)();
        let cloned = false;
        while (!cloned) {
            // If no ref provided via CLI, ask interactively
            if (!ref) {
                refType = await askRefType();
                if (refType === "branch" || refType === "both") {
                    ref = await promptUser(chalk_1.default.cyan("👉 Enter the branch name: "));
                }
                if (refType === "tag" || refType === "both") {
                    tag = await promptUser(chalk_1.default.cyan("👉 Enter the tag name: "));
                    if (refType === "tag") {
                        ref = tag;
                        tag = undefined;
                    }
                }
                if (refType === "default" && !ref) {
                    console.log(chalk_1.default.greenBright("✅ Proceeding with default branch."));
                }
            }
            const cloneOptions = ["--depth", "1"];
            if (ref) {
                cloneOptions.push("--branch", ref);
                console.log(`🔀 Using ref: ${chalk_1.default.cyan(ref)}`);
            }
            console.log(`📥 Cloning ${opts.dev}...`);
            try {
                await git.clone(opts.dev, temp.path, cloneOptions);
                // If both: checkout tag after cloning branch
                if (refType === "both" && tag) {
                    const localGit = (0, simple_git_1.default)(temp.path);
                    await localGit.checkout(tag);
                    console.log(chalk_1.default.green(`🏷️  Checked out tag: ${chalk_1.default.cyan(tag)}`));
                }
                devRepoPath = temp.path;
                cloned = true;
            }
            catch (err) {
                console.error(chalk_1.default.red(`❌ Failed to clone with ref "${ref || "default"}"`));
                console.error(chalk_1.default.gray(`⛔ ${err.message.split("\n")[0]}`));
                const retry = await promptUser(chalk_1.default.yellow("❓ Ref may not exist.\nWould you like to:\n  1) Enter new refs\n  2) Use default branch\n  3) Abort\nEnter 1, 2, or 3: "));
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
