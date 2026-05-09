import { homedir } from "node:os";
import path from "node:path";

export const YACA_HOME = process.env.YACA_HOME ?? path.join(homedir(), '.yaca');