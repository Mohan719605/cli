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
    if (opts.branch || opts.tag) {
        console.log(chalk_1.default.yellow('🛰️ Validating specified branch/tag in remote...'));
        const remoteRefs = await git.listRemote(['--refs', opts.dev]);
        const remoteBranches = Array.from(remoteRefs.matchAll(/refs\/heads\/([^\n]+)/g)).map(m => m[1]);
        const remoteTags = Array.from(remoteRefs.matchAll(/refs\/tags\/([^\n]+)/g)).map(m => m[1]);
        if (opts.branch) {
            selectedRef = opts.branch;
            if (!remoteBranches.includes(selectedRef)) {
                console.log(chalk_1.default.red(`❌ Branch '${selectedRef}' does not exist in remote.`));
                process.exit(1);
            }
            console.log(chalk_1.default.blue(`📦 Using branch '${selectedRef}'...`));
        }
        if (opts.tag) {
            selectedRef = opts.tag;
            if (!remoteTags.includes(selectedRef)) {
                console.log(chalk_1.default.red(`❌ Tag '${selectedRef}' does not exist in remote.`));
                process.exit(1);
            }
            console.log(chalk_1.default.blue(`🏷️ Using tag '${selectedRef}'...`));
        }
    }
    else {
        console.log(chalk_1.default.green(`✅ No branch or tag specified. Proceeding with default branch: '${selectedRef}'`));
    }
    console.log(chalk_1.default.green(`📥 Processing '${selectedRef}' from ${opts.dev} into temporary folder (auto-deleted)...`));
    await git.clone(opts.dev, repoPath, ['--branch', selectedRef, '--single-branch']);
    console.log(chalk_1.default.green('✅ Processing completed.'));
    return repoPath;
}
