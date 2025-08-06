"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneWithRef = cloneWithRef;
const inquirer_1 = __importDefault(require("inquirer"));
const simple_git_1 = __importDefault(require("simple-git"));
const tmp = __importStar(require("tmp-promise"));
const chalk_1 = __importDefault(require("chalk"));
async function cloneWithRef(opts) {
    const git = (0, simple_git_1.default)();
    const temp = await tmp.dir({ unsafeCleanup: true });
    const repoPath = temp.path;
    let selectedRef = 'develop';
    if (opts.branch && opts.tag) {
        console.log(chalk_1.default.red(`❌ You can't specify both --branch and --tag at the same time.`));
        process.exit(1);
    }
    if (opts.branch) {
        selectedRef = opts.branch;
        console.log(chalk_1.default.blue(`📦 Using branch '${selectedRef}'...`));
    }
    else if (opts.tag) {
        selectedRef = opts.tag;
        console.log(chalk_1.default.blue(`🏷️ Using tag '${selectedRef}'...`));
    }
    else {
        console.log(chalk_1.default.yellow('🛰️ Fetching remote refs...'));
        const remoteRefs = await git.listRemote(['--refs', opts.dev]);
        const branches = Array.from(remoteRefs.matchAll(/refs\/heads\/([^\n]+)/g)).map(m => m[1]);
        const tags = Array.from(remoteRefs.matchAll(/refs\/tags\/([^\n]+)/g)).map(m => m[1]);
        const { refType } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'refType',
                message: '📂 Do you want to select a branch or a tag?',
                choices: ['branch', 'tag'],
            },
        ]);
        if (refType === 'branch') {
            const { selectedBranch } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedBranch',
                    message: '🔀 Choose a branch to check out:',
                    choices: [{ name: 'develop (default)', value: 'develop' }, ...branches.map(b => ({ name: b, value: b }))],
                    default: 'develop',
                },
            ]);
            selectedRef = selectedBranch;
        }
        else {
            const { selectedTag } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedTag',
                    message: '🏷️ Choose a tag to check out:',
                    choices: tags.map(t => ({ name: t, value: t })),
                },
            ]);
            selectedRef = selectedTag;
        }
    }
    console.log(chalk_1.default.green(`📥 Cloning '${selectedRef}' from ${opts.dev}...`));
    await git.clone(opts.dev, repoPath, ['--branch', selectedRef, '--single-branch']);
    console.log(chalk_1.default.green('✅ Cloning completed.'));
    return repoPath;
}
