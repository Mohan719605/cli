import path from "path";
import fs from "fs-extra";
import simpleGit from "simple-git";
import tmp from "tmp-promise";
import chalk from "chalk";
import readline from "readline";
import { showDiffAndPrompt } from "../utils/diffAndPrompt";
import { showDiffAndPromptJson } from "../utils/diffAndPromptJson";

// 🚫 Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(chalk.redBright("\n\n🚫 Process interrupted by user (Ctrl+C)."));
  console.log(
    chalk.yellow(
      "ℹ️  No changes were made. If you wish to upgrade, please run the command again.\n"
    )
  );
  process.exit(0);
});

function isGitUrl(url: string): boolean {
  return url.startsWith("http") || url.endsWith(".git");
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
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
      console.log(
        chalk.redBright("\n\n🚫 Process interrupted during input (Ctrl+C).")
      );
      console.log(
        chalk.yellow(
          "ℹ️  No changes were made. If you wish to upgrade, please run the command again.\n"
        )
      );
      process.exit(0);
    });
  });
}

type RefType = "branch" | "tag" | "both" | "default";

async function askRefType(): Promise<{
  refType: RefType;
  branch?: string;
  tag?: string;
}> {
  const choice = await promptUser(
    chalk.yellow(
      `❓ Do you want to specify:\n  1) Branch\n  2) Tag\n  3) Both\n  4) Use default branch\nEnter 1, 2, 3 or 4: `
    )
  );

  let refType: RefType = "default";
  let branch: string | undefined;
  let tag: string | undefined;

  switch (choice.trim()) {
    case "1": {
      const switchToTag = await promptUser(
        chalk.yellow("❓ Do you want to choose tag instead? (y/n): ")
      );
      if (switchToTag.toLowerCase() === "y") {
        tag = await promptUser(chalk.cyan("👉 Enter the tag name: "));
        refType = "tag";
      } else {
        branch = await promptUser(chalk.cyan("👉 Enter the branch name: "));
        const alsoTag = await promptUser(
          chalk.yellow("❓ Do you also want to specify a tag? (y/n): ")
        );
        if (alsoTag.toLowerCase() === "y") {
          tag = await promptUser(chalk.cyan("👉 Enter the tag name: "));
          refType = "both";
        } else {
          refType = "branch";
        }
      }
      break;
    }

    case "2": {
      const switchToBranch = await promptUser(
        chalk.yellow("❓ Do you want to choose branch instead? (y/n): ")
      );
      if (switchToBranch.toLowerCase() === "y") {
        branch = await promptUser(chalk.cyan("👉 Enter the branch name: "));
        refType = "branch";
      } else {
        tag = await promptUser(chalk.cyan("👉 Enter the tag name: "));
        const alsoBranch = await promptUser(
          chalk.yellow("❓ Do you also want to specify a branch? (y/n): ")
        );
        if (alsoBranch.toLowerCase() === "y") {
          branch = await promptUser(chalk.cyan("👉 Enter the branch name: "));
          refType = "both";
        } else {
          refType = "tag";
        }
      }
      break;
    }

    case "3": {
      branch = await promptUser(chalk.cyan("👉 Enter the branch name: "));
      tag = await promptUser(chalk.cyan("👉 Enter the tag name: "));
      refType = "both";
      break;
    }

    case "4":
    default:
      refType = "default";
  }

  return { refType, branch, tag };
}

type UpgradeOptions = {
  dev?: string;
  files?: string;
  branch?: string;
  tag?: string;
};

export async function upgradeCommand(opts: UpgradeOptions) {
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
  let tag: string | undefined = undefined;
  let refType: RefType = "default";

  if (isGitUrl(opts.dev)) {
    const temp = await tmp.dir({ unsafeCleanup: true });
    const git = simpleGit();
    let cloned = false;

    // Use CLI input if available
    if (opts.branch && opts.tag) {
      refType = "both";
      ref = opts.branch;
      tag = opts.tag;
    } else if (opts.branch) {
      refType = "branch";
      ref = opts.branch;
    } else if (opts.tag) {
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
          } else {
            console.error(chalk.red("❌ No valid tag provided. Aborting."));
            process.exit(1);
          }
        }

        if (refType === "default") {
          console.log(chalk.greenBright("✅ Proceeding with default branch."));
        }
      }

      const cloneOptions = ["--depth", "1"];
      if (ref) cloneOptions.push("--branch", ref);

      console.log(`📥 Cloning ${opts.dev}...`);
      if (refType === "branch") {
        console.log(`🔀 Using branch: ${chalk.cyan(ref)}`);
      } else if (refType === "tag") {
        console.log(`🏷️  Using tag: ${chalk.cyan(ref)}`);
      } else if (refType === "both") {
        console.log(
          `🔀 Using branch: ${chalk.cyan(ref)} and then checking out tag...`
        );
      }

      try {
        await git.clone(opts.dev, temp.path, cloneOptions);

        if (refType === "both" && tag) {
          const localGit = simpleGit(temp.path);
          await localGit.checkout(tag);
          console.log(chalk.green(`🏷️  Checked out tag: ${chalk.cyan(tag)}`));
        }

        devRepoPath = temp.path;
        cloned = true;
      } catch (err) {
        const label =
          refType === "branch"
            ? `branch "${ref}"`
            : refType === "tag"
            ? `tag "${ref}"`
            : refType === "both"
            ? `branch "${ref}" and tag "${tag}"`
            : "default branch";

        console.error(chalk.red(`❌ Failed to clone with ${label}`));
        if (err instanceof Error) {
          console.error(chalk.gray(`⛔ ${err.message.split("\n")[0]}`));
        } else {
          console.error(
            chalk.gray("⛔ An unknown error occurred during cloning.")
          );
        }

        const retry = await promptUser(
          chalk.yellow(
            `❓ The specified ${label} may not exist.\nWould you like to:\n  1) Enter new branch/tag\n  2) Use default branch\n  3) Abort\nEnter 1, 2, or 3: `
          )
        );

        if (retry === "1") {
          ref = "";
          tag = undefined;
        } else if (retry === "2") {
          ref = "";
          tag = undefined;
          refType = "default";
        } else {
          console.error(chalk.red("❌ Aborted by user."));
          process.exit(1);
        }
      }
    }
  } else {
    devRepoPath = path.resolve(opts.dev);
  }

  const deliveryRepo = process.cwd();
  const filePaths = opts.files.split(",").map((p) => p.trim());

  for (const relativePath of filePaths) {
    const devPath = path.join(devRepoPath, relativePath);
    const deliveryPath = path.join(deliveryRepo, relativePath);

    if ((await fs.pathExists(devPath)) && (await fs.pathExists(deliveryPath))) {
      const ext = path.extname(relativePath).toLowerCase();
      if (ext === ".json") {
        await showDiffAndPromptJson(deliveryPath, devPath, relativePath);
      } else {
        await showDiffAndPrompt(deliveryPath, devPath, relativePath);
      }
    } else {
      console.warn(
        `⚠️  Missing file in one of the repos: ${chalk.yellow(relativePath)}`
      );
    }
  }

  console.log(chalk.green.bold("\n🎉 Upgrade process finished!"));
}
