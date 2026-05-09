import { homedir } from "node:os";
import path from "node:path";
//！ ✅ import 才是对的😋
import pkg from "../../../../package.json" with { type: "json" };

export const YACA_HOME = process.env.YACA_HOME ?? path.join(homedir(), '.yaca');
export const YACA_PACKAGE_NAME = pkg.name;
export const YACA_VERSION = pkg.version;
