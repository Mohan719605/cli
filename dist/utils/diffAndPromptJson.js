"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDiffAndPromptJson = showDiffAndPromptJson;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const excludeKeys = [];
function stringify(val) {
    if (typeof val === "object" && val !== null)
        return JSON.stringify(val);
    if (val === undefined)
        return "-";
    return String(val);
}
function compareJsonObjects(oldObj, newObj) {
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    const diff = [];
    for (const key of keys) {
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diff.push([key, stringify(oldVal), stringify(newVal)]);
        }
    }
    return diff;
}
/**
 * Compare two dependency objects:
 * - Exclude @sapiens/* keys from diff
 * - Return diffs for other keys only
 */
function compareJsonObjectsFilter(oldDeps, newDeps) {
    const diffs = [];
    const keys = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]);
    for (const key of keys) {
        if (key.startsWith("@sapiens-digital/") && !excludeKeys.includes(key))
            continue; // exclude sapiens in diffs
        const oldVal = oldDeps[key] ?? "-";
        const newVal = newDeps[key] ?? "-";
        if (oldVal !== newVal) {
            diffs.push([key, oldVal, newVal]);
        }
    }
    return diffs;
}
async function showDiffAndPromptJson(deliveryPath, devPath, writePath) {
    const [oldRaw, newRaw] = await Promise.all([
        fs_extra_1.default.readFile(deliveryPath, "utf-8"),
        fs_extra_1.default.readFile(devPath, "utf-8"),
    ]);
    const oldJson = JSON.parse(oldRaw);
    const newJson = JSON.parse(newRaw);
    // Check if either file path ends with package.json (case-sensitive)
    const isPackageJson = deliveryPath.endsWith("package.json") || devPath.endsWith("package.json");
    const changesToApply = [];
    if (isPackageJson) {
        const sectionsToCompare = ["dependencies", "devDependencies"];
        for (const section of sectionsToCompare) {
            const oldDeps = oldJson[section] ?? {};
            const newDeps = newJson[section] ?? {};
            if (section === "dependencies") {
                const sapiensKeys = Object.keys(oldDeps).filter((k) => k.startsWith("@sapiens-digital/") && !excludeKeys.includes(k));
                // Find the @sapiens-digital dependency in the source repo to get the version
                const sourceRepoSapiensKeys = Object.keys(newDeps).filter((k) => k.startsWith("@sapiens-digital/") && !excludeKeys.includes(k));
                // Get version from any @sapiens-digital package in source repo
                let defaultSapiensVersion;
                if (sourceRepoSapiensKeys.length > 0) {
                    defaultSapiensVersion = newDeps[sourceRepoSapiensKeys[0]];
                }
                let sapiensVersion;
                if (sapiensKeys.length > 0) {
                    // Extract repository names from paths
                    const getRepoName = (path) => {
                        const pathParts = path.split(/[/\\]/);
                        // Find the last meaningful directory name (not package.json)
                        for (let i = pathParts.length - 1; i >= 0; i--) {
                            const part = pathParts[i];
                            if (part && part !== "package.json" && !part.includes(".")) {
                                return part;
                            }
                        }
                        return "repository";
                    };
                    const sourceRepoName = getRepoName(devPath);
                    const targetRepoName = getRepoName(deliveryPath);
                    const answer = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "inputVersion",
                            message: `Enter version for all @sapiens dependencies to be updated in ${chalk_1.default.cyan(targetRepoName)} (current version: ${chalk_1.default.green(defaultSapiensVersion ?? "not found")}):`,
                            default: defaultSapiensVersion ?? "",
                        },
                    ]);
                    sapiensVersion = answer.inputVersion.trim() || defaultSapiensVersion;
                    console.log(chalk_1.default.magentaBright(`\n✨ All @sapiens dependencies will be updated to version: ${sapiensVersion ?? "[keeping old versions]"}`));
                    // Immediately add sapiens changes (without showing diff)
                    for (const sapiensKey of sapiensKeys) {
                        if (sapiensVersion) {
                            changesToApply.push({
                                section,
                                key: sapiensKey,
                                newVal: sapiensVersion,
                            });
                        }
                        // else keep old version
                    }
                }
                // Compare and prompt for non-sapiens dependencies only
                const diffs = compareJsonObjectsFilter(oldDeps, newDeps);
                if (diffs.length === 0 && sapiensKeys.length === 0)
                    continue;
                if (diffs.length > 0) {
                    console.log(chalk_1.default.cyan.bold(`\n📦 ${section}`));
                    const table = new cli_table3_1.default({
                        head: [
                            chalk_1.default.gray("Key"),
                            chalk_1.default.gray("Delivery Repo"),
                            chalk_1.default.gray("Dev Repo"),
                        ],
                        colWidths: [30, 30, 30],
                        wordWrap: true,
                    });
                    for (const [key, oldVal, newVal] of diffs) {
                        table.push([
                            key,
                            chalk_1.default.red(oldVal || "-"),
                            chalk_1.default.green(newVal || "-"),
                        ]);
                    }
                    console.log(table.toString());
                    const { selectedKeys } = await inquirer_1.default.prompt([
                        {
                            type: "checkbox",
                            name: "selectedKeys",
                            message: `Select keys to apply from ${section}: (Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed)`,
                            choices: diffs.map(([key]) => ({
                                name: key,
                                value: key,
                                checked: true,
                            })),
                            pageSize: 20,
                            instructions: false,
                        },
                    ]);
                    for (const key of selectedKeys) {
                        const newVal = newDeps[key];
                        changesToApply.push({ section, key, newVal });
                    }
                }
            }
            else {
                // For devDependencies just normal compare and prompt
                const diffs = compareJsonObjects(oldDeps, newDeps);
                if (diffs.length === 0)
                    continue;
                console.log(chalk_1.default.cyan.bold(`\n📦 ${section}`));
                const table = new cli_table3_1.default({
                    head: [
                        chalk_1.default.gray("Key"),
                        chalk_1.default.gray("Delivery Repo"),
                        chalk_1.default.gray("Dev Repo"),
                    ],
                    colWidths: [30, 30, 30],
                    wordWrap: true,
                });
                for (const [key, oldVal, newVal] of diffs) {
                    table.push([
                        key,
                        chalk_1.default.red(oldVal || "-"),
                        chalk_1.default.green(newVal || "-"),
                    ]);
                }
                console.log(table.toString());
                const { selectedKeys } = await inquirer_1.default.prompt([
                    {
                        type: "checkbox",
                        name: "selectedKeys",
                        message: `Select keys to apply from ${section}: (Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed)`,
                        choices: diffs.map(([key]) => ({
                            name: key,
                            value: key,
                            checked: true,
                        })),
                        pageSize: 20,
                        instructions: false,
                    },
                ]);
                for (const key of selectedKeys) {
                    const newVal = newDeps[key];
                    changesToApply.push({ section, key, newVal });
                }
            }
        }
    }
    else {
        // Non-package.json: compare all sections fully
        const allSections = new Set([
            ...Object.keys(oldJson),
            ...Object.keys(newJson),
        ]);
        for (const section of allSections) {
            const oldSection = oldJson[section];
            const newSection = newJson[section];
            const isObject = typeof oldSection === "object" &&
                typeof newSection === "object" &&
                !Array.isArray(oldSection) &&
                oldSection !== null &&
                newSection !== null;
            let diffs = [];
            if (isObject) {
                diffs = compareJsonObjects(oldSection, newSection);
            }
            else if (JSON.stringify(oldSection) !== JSON.stringify(newSection)) {
                diffs = [[section, stringify(oldSection), stringify(newSection)]];
            }
            if (diffs.length === 0)
                continue;
            console.log(chalk_1.default.cyan.bold(`\n📦 ${isObject ? section : "Top-Level Keys"}`));
            const table = new cli_table3_1.default({
                head: [
                    chalk_1.default.gray("Key"),
                    chalk_1.default.gray("Delivery Repo"),
                    chalk_1.default.gray("Dev Repo"),
                ],
                colWidths: [30, 30, 30],
                wordWrap: true,
            });
            for (const [key, oldVal, newVal] of diffs) {
                table.push([key, chalk_1.default.red(oldVal || "-"), chalk_1.default.green(newVal || "-")]);
            }
            console.log(table.toString());
            const { selectedKeys } = await inquirer_1.default.prompt([
                {
                    type: "checkbox",
                    name: "selectedKeys",
                    message: `Select keys to apply from ${isObject ? section : "Top-Level"}: (Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed)`,
                    choices: diffs.map(([key]) => ({
                        name: key,
                        value: key,
                        checked: true,
                    })),
                    pageSize: 20,
                    instructions: false,
                },
            ]);
            for (const key of selectedKeys) {
                const newVal = isObject ? newSection[key] : newSection;
                changesToApply.push({ section, key, newVal });
            }
        }
    }
    if (changesToApply.length === 0) {
        console.log(chalk_1.default.yellow("✅ No changes selected."));
        return;
    }
    // Final review prompt
    const finalChoices = await inquirer_1.default.prompt([
        {
            type: "checkbox",
            name: "finalKeys",
            message: chalk_1.default.bold.yellow("🧾 Final Review: Select the keys you want to apply (Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed)"),
            choices: changesToApply.map(({ section, key }) => ({
                name: chalk_1.default.cyan(section) + chalk_1.default.gray(".") + chalk_1.default.green(key),
                value: `${section}:::${key}`,
                checked: true,
            })),
            pageSize: 15,
            instructions: false,
        },
    ]);
    const finalSet = new Set(finalChoices.finalKeys);
    const filteredChanges = changesToApply.filter(({ section, key }) => finalSet.has(`${section}:::${key}`));
    if (filteredChanges.length === 0) {
        console.log(chalk_1.default.red("❌ All changes were deselected. Aborting write."));
        return;
    }
    // Apply changes into oldJson object
    for (const { section, key, newVal } of filteredChanges) {
        const isObject = typeof oldJson[section] === "object" && oldJson[section] !== null;
        if (isObject) {
            if (!oldJson[section])
                oldJson[section] = {};
            oldJson[section][key] = newVal;
        }
        else {
            oldJson[section] = newVal;
        }
    }
    // Confirm write
    const { confirmWrite } = await inquirer_1.default.prompt([
        {
            type: "confirm",
            name: "confirmWrite",
            message: `Do you want to write these ${filteredChanges.length} change(s) to ${writePath}?`,
            default: true,
        },
    ]);
    if (confirmWrite) {
        await fs_extra_1.default.writeJson(writePath, oldJson, { spaces: 2 });
        console.log(chalk_1.default.green(`✅ Updated ${writePath}`));
    }
    else {
        console.log(chalk_1.default.red("❌ Changes discarded."));
    }
}
