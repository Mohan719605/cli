import chalk from "chalk";
import { select, input } from "@inquirer/prompts";

export type RefType = "branch" | "tag" | "default";

export async function promptUser(question: string): Promise<string> {
  return await input({ message: question });
}

export async function askRefType(): Promise<{
  refType: RefType;
  branch?: string;
  tag?: string;
}> {
  const choice = await select({
    message: "How would you like to specify the Git reference?",
    choices: [
      {
        name: "🔀 Specify a branch",
        value: "branch",
        description: "Clone from a specific branch",
      },
      {
        name: "🏷️  Specify a tag",
        value: "tag",
        description: "Clone from a specific tag",
      },
      {
        name: "📌 Use default branch",
        value: "default",
        description: "Clone from the repository's default branch",
      },
    ],
  });

  let refType: RefType = choice as RefType;
  let branch: string | undefined;
  let tag: string | undefined;

  switch (refType) {
    case "branch": {
      // Confirm choice and allow switching to tag
      const confirm = await select({
        message: "You selected branch. What would you like to do?",
        choices: [
          {
            name: "✅ Continue with branch",
            value: "continue",
            description: "Enter a branch name",
          },
          {
            name: "🔄 Switch to tag instead",
            value: "switch-to-tag",
            description: "Choose a tag instead of a branch",
          },
        ],
      });

      if (confirm === "switch-to-tag") {
        refType = "tag";
        tag = await input({
          message: "Enter the tag name:",
          validate: (input) =>
            input.trim() !== "" || "Tag name cannot be empty",
        });
      } else {
        branch = await input({
          message: "Enter the branch name:",
          validate: (input) =>
            input.trim() !== "" || "Branch name cannot be empty",
        });
      }
      break;
    }
    case "tag": {
      // Confirm choice and allow switching to branch
      const confirm = await select({
        message: "You selected tag. What would you like to do?",
        choices: [
          {
            name: "✅ Continue with tag",
            value: "continue",
            description: "Enter a tag name",
          },
          {
            name: "🔄 Switch to branch instead",
            value: "switch-to-branch",
            description: "Choose a branch instead of a tag",
          },
        ],
      });

      if (confirm === "switch-to-branch") {
        refType = "branch";
        branch = await input({
          message: "Enter the branch name:",
          validate: (input) =>
            input.trim() !== "" || "Branch name cannot be empty",
        });
      } else {
        tag = await input({
          message: "Enter the tag name:",
          validate: (input) =>
            input.trim() !== "" || "Tag name cannot be empty",
        });
      }
      break;
    }
    case "default":
    default:
      // No additional input needed
      break;
  }

  return { refType, branch, tag };
}

export async function askRetryOptions(label: string): Promise<string> {
  return await select({
    message: `The specified ${label} may not exist. What would you like to do?`,
    choices: [
      {
        name: "🔄 Enter new branch/tag",
        value: "1",
        description: "Try again with a different branch or tag",
      },
      {
        name: "📌 Use default branch",
        value: "2",
        description: "Proceed with the repository's default branch",
      },
      {
        name: "❌ Abort",
        value: "3",
        description: "Cancel the upgrade process",
      },
    ],
  });
}
