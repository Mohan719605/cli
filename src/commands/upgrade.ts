import path from "path";
import fs from "fs-extra";
import simpleGit from "simple-git";
import tmp from "tmp-promise";
import chalk from "chalk";
import { showDiffAndPrompt } from "../utils/diffAndPrompt";
import { showDiffAndPromptJson } from "../utils/diffAndPromptJson";
import {
  askRefType,
  promptUser,
  RefType,
  askRetryOptions,
} from "../utils/upgradeHelpers";

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

  // Validate that both branch and tag are not provided
  if (opts.branch && opts.tag) {
    console.error(
      chalk.red(
        "❌ Error: Both --branch and --tag options cannot be used together."
      )
    );
    console.error(
      chalk.yellow("ℹ️  Please specify either --branch OR --tag, not both.")
    );
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
    let wasProvidedViaCLI = false;

    // Use CLI input if available
    if (opts.branch) {
      refType = "branch";
      ref = opts.branch;
      wasProvidedViaCLI = true;
    } else if (opts.tag) {
      refType = "tag";
      ref = opts.tag;
      tag = opts.tag;
      wasProvidedViaCLI = true;
    }

    while (!cloned) {
      if (!ref) {
        const result = await askRefType();
        refType = result.refType;
        ref = result.branch || result.tag || "";
        tag = result.tag;
        wasProvidedViaCLI = false; // Reset since user is now providing input interactively

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
          console.log(chalk.greenBright("✅ Proceeding with default branch (develop)."));
        }
      }

      const cloneOptions = ["--depth", "1"];
      if (ref) cloneOptions.push("--branch", ref);

      console.log(`📥 Cloning ${opts.dev}...`);
      if (refType === "branch") {
        console.log(`🔀 Using branch: ${chalk.cyan(ref)}`);
      } else if (refType === "tag") {
        console.log(`🏷️  Using tag: ${chalk.cyan(ref)}`);
      }

      try {
        await git.clone(opts.dev, temp.path, cloneOptions);
        devRepoPath = temp.path;
        cloned = true;
      } catch (err) {
        const label =
          refType === "branch"
            ? `branch "${ref}"`
            : refType === "tag"
            ? `tag "${ref}"`
            : "default branch";

        console.error(chalk.red(`❌ Failed to clone with ${label}`));
        if (err instanceof Error) {
          console.error(chalk.gray(`⛔ ${err.message.split("\n")[0]}`));
        } else {
          console.error(
            chalk.gray("⛔ An unknown error occurred during cloning.")
          );
        }

        const retry = await askRetryOptions(label, wasProvidedViaCLI);

        if (retry === "1") {
          ref = "";
          tag = undefined;
          wasProvidedViaCLI = false; // User will now provide input interactively
        } else if (retry === "2") {
          ref = "";
          tag = undefined;
          refType = "default";
          wasProvidedViaCLI = false;
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
