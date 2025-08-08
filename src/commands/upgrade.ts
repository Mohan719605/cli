import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import inquirer from "inquirer";
import { showDiffAndPrompt } from "../utils/diffAndPrompt";
import { sharedPortals } from "../utils/portalsListConfig";
import { cloneWithRef } from "../utils/selectGitRef";

type UpgradeOptions = {
  dev?: string;
  files?: string; // this will now be a path to package.json or config file
  branch?: string;
  tag?: string;
};

const defaultFiles = [
  { name: "Next Config File", filename: "next.config.js" },
  { name: "Env File", filename: ".env" },
  { name: "Package File", filename: "package.json" },
  { name: "ts-config", filename: "tsconfig.json" },
  { name: "Docker File", filename: "Dockerfile" },
  { name: "Portal Registry", filename: "portal-registry.ts" },
];

function isGitUrl(url: string): boolean {
  return url.startsWith("http") || url.endsWith(".git");
}

// Helper to load files array from package.json (or general JSON file path)
async function loadFilesFromJson(jsonFilePath: string): Promise<string[]> {
  if (!(await fs.pathExists(jsonFilePath))) {
    console.error(chalk.red(`❌ File not found at: ${jsonFilePath}`));
    process.exit(1);
  }
  try {
    const content = await fs.readFile(jsonFilePath, "utf-8");
    const json = JSON.parse(content);

    // Assuming file list is at json.upgradeFiles (adjust key as needed)
    if (!json.upgradeFiles || !Array.isArray(json.upgradeFiles)) {
      console.error(
        chalk.red(
          `❌ Missing or invalid 'upgradeFiles' array in ${jsonFilePath}`
        )
      );
      process.exit(1);
    }

    // Validate array elements are strings
    if (!json.upgradeFiles.every((f: any) => typeof f === "string")) {
      console.error(
        chalk.red(
          `❌ 'upgradeFiles' should be an array of strings in ${jsonFilePath}`
        )
      );
      process.exit(1);
    }

    return json.upgradeFiles;
  } catch (err) {
    console.error(
      chalk.red(
        `❌ Failed to parse JSON from ${jsonFilePath}: ${
          (err as Error).message
        }`
      )
    );
    process.exit(1);
  }
}

export async function upgradeCommand(opts: UpgradeOptions) {
  if (!opts.dev) {
    console.error(chalk.red("❌ Please provide --dev <path_or_git_url>"));
    process.exit(1);
  }

  let selectedFiles: string[] = [];

  let devRepoPath = "";
  if (isGitUrl(opts.dev)) {
    devRepoPath = await cloneWithRef({
      dev: opts.dev,
      branch: opts.branch,
      tag: opts.tag,
    });
  } else {
    devRepoPath = path.resolve(opts.dev);
  }

  const deliveryRepo = process.cwd();

  if (!opts.files) {
    console.log(
      chalk.bold.yellow(
        "⚠️  No custom files were selected. Here are some default files — which one would you like to edit?"
      )
    );

    const { selected } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selected",
        message: "Select files to compare and upgrade:",
        choices: defaultFiles.map((file) => ({
          name: `${file.name} (${file.filename})`,
          value: file.filename,
          checked: true,
        })),
        validate: (input) =>
          input.length > 0 || "Please select at least one file.",
      },
    ]);
    selectedFiles = selected;

    // For each selected file ask portal location and process
    for (const filename of selectedFiles) {
      const fileMeta = defaultFiles.find((f) => f.filename === filename);
      let finalPath = "";

      if (fileMeta) {
        const { selectedPortal } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedPortal",
            message: `📂 Where is ${chalk.yellow(filename)} located?`,
            choices: sharedPortals.map((p) => ({
              name: `${p.label} (${path.join(p.basePath, filename)})`,
              value: p.basePath,
            })),
          },
        ]);
        finalPath = path.join(selectedPortal, filename);
      } else {
        finalPath = filename;
      }

      const devPath = path.join(devRepoPath, finalPath);
      const deliveryPath = path.join(deliveryRepo, finalPath);

      if (
        (await fs.pathExists(devPath)) &&
        (await fs.pathExists(deliveryPath))
      ) {
        await showDiffAndPrompt(deliveryPath, devPath, finalPath);
      } else {
        console.warn(
          `⚠️  Missing file in one of the repos: ${chalk.yellow(finalPath)}`
        );
      }
    }
  } else {
    // --files option is provided:
    // Check if it's a direct file path or a config file with upgradeFiles array
    const filePath = path.isAbsolute(opts.files)
      ? opts.files
      : path.join(process.cwd(), opts.files);

    // Check if the file exists and if it's a direct file to upgrade vs config file
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const json = JSON.parse(content);

        // If it has upgradeFiles array, treat as config file
        if (json.upgradeFiles && Array.isArray(json.upgradeFiles)) {
          selectedFiles = await loadFilesFromJson(filePath);

          // Process files from config
          for (const finalPath of selectedFiles) {
            const devPath = path.join(devRepoPath, finalPath);
            const deliveryPath = path.join(deliveryRepo, finalPath);

            if (
              (await fs.pathExists(devPath)) &&
              (await fs.pathExists(deliveryPath))
            ) {
              await showDiffAndPrompt(deliveryPath, devPath, finalPath);
            } else {
              console.warn(
                `⚠️  Missing file in one of the repos: ${chalk.yellow(
                  finalPath
                )}`
              );
            }
          }
        } else {
          // Treat as direct file to upgrade
          const finalPath = opts.files;
          const devPath = path.join(devRepoPath, finalPath);
          const deliveryPath = path.join(deliveryRepo, finalPath);

          if (
            (await fs.pathExists(devPath)) &&
            (await fs.pathExists(deliveryPath))
          ) {
            await showDiffAndPrompt(deliveryPath, devPath, finalPath);
          } else {
            console.warn(
              `⚠️  Missing file in one of the repos: ${chalk.yellow(finalPath)}`
            );
          }
        }
      } catch (err) {
        console.error(
          chalk.red(
            `❌ Failed to parse or process file ${filePath}: ${
              (err as Error).message
            }`
          )
        );
        process.exit(1);
      }
    } else {
      console.error(chalk.red(`❌ File not found at: ${filePath}`));
      process.exit(1);
    }
  }

  console.log(chalk.green.bold("\n🎉 Upgrade process finished!"));
}
