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
const diffAndPrompt_1 = require("../utils/diffAndPrompt");
const diffAndPromptJson_1 = require("../utils/diffAndPromptJson");
const upgradeHelpers_1 = require("../utils/upgradeHelpers");
// 🚫 Handle Ctrl+C gracefully
process.on("SIGINT", () => {
    console.log(chalk_1.default.redBright("\n\n🚫 Process interrupted by user (Ctrl+C)."));
    console.log(chalk_1.default.yellow("ℹ️  No changes were made. If you wish to upgrade, please run the command again.\n"));
    process.exit(0);
});
function isGitUrl(url) {
    return url.startsWith("http") || url.endsWith(".git");
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
    // Validate that both branch and tag are not provided
    if (opts.branch && opts.tag) {
        console.error(chalk_1.default.red("❌ Error: Both --branch and --tag options cannot be used together."));
        console.error(chalk_1.default.yellow("ℹ️  Please specify either --branch OR --tag, not both."));
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
        let wasProvidedViaCLI = false;
        // Use CLI input if available
        if (opts.branch) {
            refType = "branch";
            ref = opts.branch;
            wasProvidedViaCLI = true;
        }
        else if (opts.tag) {
            refType = "tag";
            ref = opts.tag;
            tag = opts.tag;
            wasProvidedViaCLI = true;
        }
        while (!cloned) {
            if (!ref) {
                const result = await (0, upgradeHelpers_1.askRefType)();
                refType = result.refType;
                ref = result.branch || result.tag || "";
                tag = result.tag;
                wasProvidedViaCLI = false; // Reset since user is now providing input interactively
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
            try {
                await git.clone(opts.dev, temp.path, cloneOptions);
                devRepoPath = temp.path;
                cloned = true;
            }
            catch (err) {
                const label = refType === "branch"
                    ? `branch "${ref}"`
                    : refType === "tag"
                        ? `tag "${ref}"`
                        : "default branch";
                console.error(chalk_1.default.red(`❌ Failed to clone with ${label}`));
                if (err instanceof Error) {
                    console.error(chalk_1.default.gray(`⛔ ${err.message.split("\n")[0]}`));
                }
                else {
                    console.error(chalk_1.default.gray("⛔ An unknown error occurred during cloning."));
                }
                const retry = await (0, upgradeHelpers_1.askRetryOptions)(label, wasProvidedViaCLI);
                if (retry === "1") {
                    ref = "";
                    tag = undefined;
                    wasProvidedViaCLI = false; // User will now provide input interactively
                }
                else if (retry === "2") {
                    ref = "";
                    tag = undefined;
                    refType = "default";
                    wasProvidedViaCLI = false;
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
