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
function isGitUrl(url) {
    return url.startsWith('http') || url.endsWith('.git');
}
async function upgradeCommand(opts) {
    if (!opts.dev) {
        console.error('❌ Please provide --dev <path_or_git_url>');
        process.exit(1);
    }
    if (!opts.files) {
        console.error('❌ Please provide --files <comma_separated_paths>');
        process.exit(1);
    }
    let devRepoPath = '';
    if (isGitUrl(opts.dev)) {
        const temp = await tmp_promise_1.default.dir({ unsafeCleanup: true });
        console.log(`📥 Cloning ${opts.dev}...`);
        await (0, simple_git_1.default)().clone(opts.dev, temp.path);
        devRepoPath = temp.path;
    }
    else {
        devRepoPath = path_1.default.resolve(opts.dev);
    }
    const deliveryRepo = process.cwd();
    //  Split user file input
    const filePaths = opts.files.split(',').map(p => p.trim());
    for (const relativePath of filePaths) {
        const devPath = path_1.default.join(devRepoPath, relativePath);
        const deliveryPath = path_1.default.join(deliveryRepo, relativePath);
        if (await fs_extra_1.default.pathExists(devPath) && await fs_extra_1.default.pathExists(deliveryPath)) {
            await (0, diffAndPrompt_1.showDiffAndPrompt)(deliveryPath, devPath, relativePath);
        }
        else {
            console.warn(`⚠️  Missing file in one of the repos: ${chalk_1.default.yellow(relativePath)}`);
        }
    }
    console.log(chalk_1.default.green.bold('\n🎉 Upgrade process finished!'));
}
