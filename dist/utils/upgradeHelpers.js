"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptUser = promptUser;
exports.askRefType = askRefType;
exports.askRetryOptions = askRetryOptions;
const prompts_1 = require("@inquirer/prompts");
async function promptUser(question) {
    return await (0, prompts_1.input)({ message: question });
}
async function askRefType() {
    const choice = await (0, prompts_1.select)({
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
    let refType = choice;
    let branch;
    let tag;
    switch (refType) {
        case "branch": {
            // Confirm choice and allow switching to tag
            const confirm = await (0, prompts_1.select)({
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
                tag = await (0, prompts_1.input)({
                    message: "Enter the tag name:",
                    validate: (input) => input.trim() !== "" || "Tag name cannot be empty",
                });
            }
            else {
                branch = await (0, prompts_1.input)({
                    message: "Enter the branch name:",
                    validate: (input) => input.trim() !== "" || "Branch name cannot be empty",
                });
            }
            break;
        }
        case "tag": {
            // Confirm choice and allow switching to branch
            const confirm = await (0, prompts_1.select)({
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
                branch = await (0, prompts_1.input)({
                    message: "Enter the branch name:",
                    validate: (input) => input.trim() !== "" || "Branch name cannot be empty",
                });
            }
            else {
                tag = await (0, prompts_1.input)({
                    message: "Enter the tag name:",
                    validate: (input) => input.trim() !== "" || "Tag name cannot be empty",
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
async function askRetryOptions(label, wasProvidedViaCLI = false) {
    const choices = [
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
    ];
    if (wasProvidedViaCLI) {
        choices[0].description = "Enter a different branch or tag interactively";
    }
    return await (0, prompts_1.select)({
        message: `The specified ${label} may not exist. What would you like to do?`,
        choices,
    });
}
