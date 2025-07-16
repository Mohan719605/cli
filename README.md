# 🛠️ Portal Upgrade CLI

A powerful command-line tool that helps you compare and upgrade configuration files between your local delivery repo and the dev version of the Portal Foundation Template. It displays diffs, highlights changes side-by-side Git-style, and lets you selectively apply updates with one click.

---

## 🚀 Features

- 📥 Clone or use a local dev repo path
- 📄 Compare multiple files including JSON, TS, JS, and config files
- ✅ Accept or skip each change
- 🔴🟢 Git-style side-by-side diff in the terminal
- 🌐 Works with any GitHub or local repo
- 📦 Smart JSON key comparison for package.json, tsconfig.json, etc.

---

## 📦 Installation

Clone and install globally:

```bash
git clone https://github.com/your-org/portal-upgrade-cli.git
cd portal-upgrade-cli
npm install -g .
```
## Usage
Open Terminal in your template or delivery repo

```bash
portal-upgrade upgrade --dev <dev_repo_path_or_git_url> --files <comma_separated_files>
```
## Example Command
if local file
```bash
portal-upgrade upgrade --dev C:\sapiens-projects\sapiens-digital-portal --files ./apps/agent-portal/next.config.js
```
if from remote-repo
```bash
portal-upgrade upgrade --dev https://github.com/Sapiens-Digital01/sapiens-digital-portal.git --files ./apps/agent-portal/next.config.js
```
