import path from "path";
import fs from "fs-extra";
import simpleGit from "simple-git";
import tmp from "tmp-promise";
import chalk from "chalk";
import readline from "readline";
import { showDiffAndPrompt } from "../utils/diffAndPrompt";
import { showDiffAndPromptJson } from "../utils/diffAndPromptJson";

function isGitUrl(url: string): boolean {
  return url.startsWith("http") || url.endsWith(".git");
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

type RefType = "branch" | "tag" | "both" | "default";

async function askRefType(): Promise<RefType> {
  const choice = await promptUser(
    chalk.yellow(
      `❓ Do you want to specify:\n  1) Branch\n  2) Tag\n  3) Both\n  4) Use default branch\nEnter 1, 2, 3 or 4: `
    )
  );

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

type UpgradeOptions = {
  dev?: string;
  ref?: string; // user can pass this directly
  files?: string;
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
  let ref = opts.ref;
  let tag: string | undefined;
  let refType: RefType = "default";

  if (isGitUrl(opts.dev)) {
    const temp = await tmp.dir({ unsafeCleanup: true });
    const git = simpleGit();
    let cloned = false;

    while (!cloned) {
      // If no ref provided via CLI, ask interactively
      if (!ref) {
        refType = await askRefType();

        if (refType === "branch" || refType === "both") {
          ref = await promptUser(chalk.cyan("👉 Enter the branch name: "));
        }

        if (refType === "tag" || refType === "both") {
          tag = await promptUser(chalk.cyan("👉 Enter the tag name: "));
          if (refType === "tag") {
            ref = tag;
            tag = undefined;
          }
        }

        if (refType === "default" && !ref) {
          console.log(chalk.greenBright("✅ Proceeding with default branch."));
        }
      }

      const cloneOptions = ["--depth", "1"];
      if (ref) {
        cloneOptions.push("--branch", ref);
        console.log(`🔀 Using ref: ${chalk.cyan(ref)}`);
      }

      console.log(`📥 Cloning ${opts.dev}...`);

      try {
        await git.clone(opts.dev, temp.path, cloneOptions);

        // If both: checkout tag after cloning branch
        if (refType === "both" && tag) {
          const localGit = simpleGit(temp.path);
          await localGit.checkout(tag);
          console.log(chalk.green(`🏷️  Checked out tag: ${chalk.cyan(tag)}`));
        }

        devRepoPath = temp.path;
        cloned = true;
      } catch (err: any) {
        console.error(
          chalk.red(`❌ Failed to clone with ref "${ref || "default"}"`)
        );
        console.error(chalk.gray(`⛔ ${err.message.split("\n")[0]}`));

        const retry = await promptUser(
          chalk.yellow(
            "❓ Ref may not exist.\nWould you like to:\n  1) Enter new refs\n  2) Use default branch\n  3) Abort\nEnter 1, 2, or 3: "
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
