const COLORS = {
  reset: '\x1b[0m',
  white: '\x1b[37m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};


export class Logger {
  constructor(private readonly name: string) { }

  private _logPrefix(): string {
    return `${new Date().toLocaleString()} [${this.name}]`;
  }


  debug(message: string): void {
    if (process.env.DEBUG === 'true')
      console.debug(`${COLORS.cyan}${this._logPrefix()} DEBUG ${message}${COLORS.reset}`);
  }

  info(message: string, forcePrint: boolean = false): void {
    if (forcePrint || process.env.DEBUG === 'true')
      console.info(`${COLORS.white}${this._logPrefix()} INFO ${message}${COLORS.reset}`);
  }

  warn(message: string, forcePrint: boolean = false): void {
    if (forcePrint || process.env.DEBUG === 'true')
      console.warn(`${COLORS.yellow}${this._logPrefix()} WARN ${message}${COLORS.reset}`);
  }

  error(message: string, forcePrint: boolean = false): void {
    if (forcePrint || process.env.DEBUG === 'true')
      console.error(`${COLORS.red}${this._logPrefix()} ERROR ${message}${COLORS.reset}`);
  }
}