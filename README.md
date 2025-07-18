## Installation

Clone and install packages:

```bash
git clone https://github.com/Mohan719605/cli.git
cd cli
npm i
```
Run and Install CLI globally
```bash
npx tsc
npm install -g .
```
## Usage
Open Terminal in your template or delivery repo

```bash
portal-upgrade upgrade --dev <dev_repo_path_or_git_url> --files <comma_separated_files>
```
## Example Command
If local file
```bash
portal-upgrade upgrade --dev C:\sapiens-projects\sapiens-digital-portal --files ./apps/agent-portal/next.config.js
```
If from remote-repo
```bash
portal-upgrade upgrade --dev https://github.com/Sapiens-Digital01/sapiens-digital-portal.git --files ./apps/agent-portal/next.config.js
```

## If you want to change code and use it
Run in path of cli-task project
```bash
npx tsc
```
It will update your dist files accordingly and update CLI-TOOL globally
