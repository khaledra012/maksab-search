import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "server", "_core", "gtts_helper.py");
const targetPath = path.join(projectRoot, "dist", "gtts_helper.py");

mkdirSync(path.dirname(targetPath), { recursive: true });
copyFileSync(sourcePath, targetPath);

console.log(`[build] Copied ${sourcePath} -> ${targetPath}`);
