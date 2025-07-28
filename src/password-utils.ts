import inquirer from 'inquirer';
import chalk from 'chalk';

export interface PasswordOptions {
  env?: string;
  prompt?: string;
  confirm?: boolean;
  fallback?: string;
}

export class PasswordManager {
  /**
   * Get password from various sources in order of priority:
   * 1. Fallback value (command line argument)
   * 2. Environment variable (if specified)
   * 3. Interactive prompt (if terminal is interactive)
   * 4. Error if no password available
   */
  static async getPassword(options: PasswordOptions = {}): Promise<string> {
    const {
      env = 'WALLET_PASSWORD',
      prompt = 'Enter wallet password:',
      confirm = false,
      fallback
    } = options;

    // 1. Use command line password first if provided
    if (fallback) {
      return fallback;
    }

    // 2. Try environment variable second
    const envPassword = process.env[env];
    if (envPassword) {
      console.log(chalk.gray(`Using password from environment variable: ${env}`));
      return envPassword;
    }

    // 3. Try interactive prompt if terminal is interactive
    if (process.stdin.isTTY && process.stdout.isTTY) {
      try {
        if (confirm) {
          return await this.promptPasswordWithConfirmation(prompt);
        } else {
          return await this.promptPassword(prompt);
        }
      } catch (error) {
        console.error(chalk.yellow('⚠ Failed to get password interactively'));
      }
    }

    // 4. No password available
    throw new Error(
      `No password available. Please provide password via:\n` +
      `  • Command line option: --password\n` +
      `  • Environment variable: ${env}\n` +
      `  • Interactive prompt (run in terminal)`
    );
  }

  /**
   * Prompt for password with hidden input
   */
  static async promptPassword(message: string): Promise<string> {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message,
        mask: '*',
        validate: (input: string) => {
          if (!input || input.length === 0) {
            return 'Password cannot be empty';
          }
          if (input.length < 6) {
            return 'Password must be at least 6 characters long';
          }
          return true;
        }
      }
    ]);

    return answers.password;
  }

  /**
   * Prompt for password with confirmation
   */
  static async promptPasswordWithConfirmation(message: string): Promise<string> {
    const passwordAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message,
        mask: '*',
        validate: (input: string) => {
          if (!input || input.length === 0) {
            return 'Password cannot be empty';
          }
          if (input.length < 6) {
            return 'Password must be at least 6 characters long';
          }
          return true;
        }
      }
    ]);

    const confirmAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'confirmPassword',
        message: 'Confirm password:',
        mask: '*',
        validate: (input: string) => {
          if (input !== passwordAnswer.password) {
            return 'Passwords do not match';
          }
          return true;
        }
      }
    ]);

    return passwordAnswer.password;
  }

  /**
   * Get password for wallet operations (loading existing wallets)
   */
  static async getWalletPassword(alias: string, cmdPassword?: string): Promise<string> {
    return await this.getPassword({
      env: 'WALLET_PASSWORD',
      prompt: `Enter password for wallet '${alias}':`,
      confirm: false,
      fallback: cmdPassword
    });
  }

  /**
   * Get password for wallet creation (new wallets)
   */
  static async getNewWalletPassword(alias: string, cmdPassword?: string): Promise<string> {
    return await this.getPassword({
      env: 'NEW_WALLET_PASSWORD',
      prompt: `Set password for new wallet '${alias}':`,
      confirm: true,
      fallback: cmdPassword
    });
  }

  /**
   * Get keystore password for importing
   */
  static async getKeystorePassword(keystoreFile: string, cmdPassword?: string): Promise<string> {
    return await this.getPassword({
      env: 'KEYSTORE_PASSWORD',
      prompt: `Enter password for keystore file '${keystoreFile}':`,
      confirm: false,
      fallback: cmdPassword
    });
  }

  /**
   * Show help information about password options
   */
  static showPasswordHelp(): void {
    console.log(chalk.blue('\n=== Password Options ==='));
    console.log('Passwords can be provided in the following ways (in order of priority):');
    console.log(`${chalk.green('1. Command Line Options:')}`);
    console.log('   • --password <password>  - Direct password');
    console.log(`${chalk.green('2. Environment Variables:')}`);
    console.log('   • WALLET_PASSWORD        - For loading existing wallets');
    console.log('   • NEW_WALLET_PASSWORD    - For creating new wallets');
    console.log('   • KEYSTORE_PASSWORD      - For importing keystore files');
    console.log(`${chalk.green('3. Interactive Prompts:')}`);
    console.log('   • Secure hidden input when running in terminal');
    console.log('   • Password confirmation for new wallets');
    console.log(`${chalk.green('4. Examples:')}`);
    console.log('   ethers-wallet-manager wallet create my-wallet --password mypass');
    console.log('   # or');
    console.log('   export WALLET_PASSWORD="mysecretpassword"');
    console.log('   ethers-wallet-manager wallet create my-wallet');
    console.log();
  }
}