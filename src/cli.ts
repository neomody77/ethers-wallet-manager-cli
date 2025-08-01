#!/usr/bin/env node

import { Command } from 'commander';
import { WalletManager } from './wallet-manager';
import { PasswordManager } from './password-utils';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

const program = new Command();

program
  .name('ethers-wallet-manager')
  .description('CLI for managing Ethereum wallets with ethers.js')
  .version('1.3.0')
  .option('--password-help', 'Show password options help')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().passwordHelp) {
      PasswordManager.showPasswordHelp();
      process.exit(0);
    }
  });

// Initialize wallet manager instance
let walletManager: WalletManager;

function initWalletManager() {
  if (!walletManager) {
    walletManager = new WalletManager();
  }
  return walletManager;
}

// Configuration commands
const configCmd = program
  .command('config')
  .description('Manage wallet configuration')
  .action(() => {
    configCmd.help();
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const wm = initWalletManager();
    const config = wm.getConfig();
    
    console.log(chalk.blue('\n=== Wallet Manager Configuration ==='));
    console.log(`${chalk.green('Config Directory:')} ${wm.getConfigDir()}`);
    console.log(`${chalk.green('Keystore Directory:')} ${wm.getKeystoreDir()}`);
    console.log(`${chalk.green('Default Network:')} ${wm.getDefaultNetwork()}`);
    console.log(`${chalk.green('Current Network:')} ${wm.getCurrentNetwork()}`);
    const defaultAccount = wm.getDefaultAccount();
    if (defaultAccount) {
      console.log(`${chalk.green('Default Account:')} ${defaultAccount}`);
    }
    console.log(`${chalk.green('Version:')} ${config.version}`);
    console.log(`${chalk.green('Created:')} ${new Date(config.createdAt).toLocaleString()}`);
    console.log(`${chalk.green('Updated:')} ${new Date(config.updatedAt).toLocaleString()}`);
  });

configCmd
  .command('set-keystore-dir <directory>')
  .description('Set keystore directory')
  .action((directory: string) => {
    const wm = initWalletManager();
    wm.updateKeystoreDir(directory);
    console.log(chalk.green(`✓ Keystore directory updated to: ${wm.getKeystoreDir()}`));
  });

configCmd
  .command('set-default-network <network>')
  .description('Set default network for new wallets')
  .action((network: string) => {
    const wm = initWalletManager();
    wm.updateDefaultNetwork(network);
    console.log(chalk.green(`✓ Default network updated to: ${network}`));
  });

configCmd
  .command('set-current-network <network>')
  .description('Set current active network')
  .action((network: string) => {
    const wm = initWalletManager();
    wm.updateCurrentNetwork(network);
    console.log(chalk.green(`✓ Current network updated to: ${network}`));
  });

configCmd
  .command('set-default-account <alias>')
  .description('Set default account/wallet')
  .action((alias: string) => {
    const wm = initWalletManager();
    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }
    wm.updateDefaultAccount(alias);
    console.log(chalk.green(`✓ Default account updated to: ${alias}`));
  });

configCmd
  .command('export <file>')
  .description('Export configuration to file')
  .action((file: string) => {
    const wm = initWalletManager();
    wm.exportConfig(file);
    console.log(chalk.green(`✓ Configuration exported to: ${file}`));
  });

configCmd
  .command('import <file>')
  .description('Import configuration from file')
  .action((file: string) => {
    const wm = initWalletManager();
    try {
      wm.importConfig(file);
      console.log(chalk.green(`✓ Configuration imported from: ${file}`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to import config: ${error}`));
    }
  });

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => {
    const wm = initWalletManager();
    wm.resetConfig();
    console.log(chalk.green('✓ Configuration reset to defaults'));
  });

// Quick commands
const quickCmd = program
  .command('quick')
  .description('Manage quick command templates')
  .action(() => {
    quickCmd.help();
  });

quickCmd
  .command('add <name> <parameters> <template>')
  .description('Add a new quick command template')
  .option('-d, --description <desc>', 'Description of the quick command')
  .action((name: string, parameters: string, template: string, options) => {
    const wm = initWalletManager();
    
    // Parse parameters - expect format like "aa bb cc"
    const paramList = parameters.trim().split(/\s+/).filter(p => p.length > 0);
    
    // Auto-detect parameters from template if not provided
    const detectedParams = wm.getQuickCommandManager().parseParametersFromTemplate(template);
    const finalParams = paramList.length > 0 ? paramList : detectedParams;
    
    if (finalParams.length === 0) {
      console.error(chalk.red('✗ No parameters specified and none detected in template'));
      console.log('Example: vlet quick add mint "amount recipient" "call my-wallet 0x123... \\"mint(uint256,address)\\" $amount $recipient"');
      return;
    }

    try {
      wm.addQuickCommand(name, finalParams, template, options.description);
      console.log(chalk.green(`✓ Quick command '${name}' added successfully`));
      console.log(`${chalk.blue('Parameters:')} ${finalParams.join(', ')}`);
      console.log(`${chalk.blue('Template:')} ${template}`);
      if (options.description) {
        console.log(`${chalk.blue('Description:')} ${options.description}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to add quick command: ${error}`));
    }
  });

quickCmd
  .command('list')
  .description('List all quick commands')
  .action(() => {
    const wm = initWalletManager();
    const commands = wm.listQuickCommands();
    
    if (commands.length === 0) {
      console.log(chalk.yellow('No quick commands found'));
      return;
    }

    console.log(chalk.blue('\n=== Quick Commands ==='));
    commands.forEach(cmd => {
      console.log(`${chalk.green('•')} ${cmd.name}`);
      console.log(`  ${chalk.gray('Parameters:')} ${cmd.parameters.join(', ')}`);
      console.log(`  ${chalk.gray('Template:')} ${cmd.template}`);
      if (cmd.description) {
        console.log(`  ${chalk.gray('Description:')} ${cmd.description}`);
      }
      console.log(`  ${chalk.gray('Created:')} ${new Date(cmd.createdAt).toLocaleString()}`);
      console.log();
    });
  });

quickCmd
  .command('call <name> [args...]')
  .description('Execute a quick command')
  .option('-p, --password <password>', 'Wallet password (or use env: WALLET_PASSWORD)')
  .option('--wait', 'Wait for transaction confirmation')
  .action(async (name: string, args: string[], options) => {
    const wm = initWalletManager();
    const command = wm.getQuickCommand(name);
    
    if (!command) {
      console.error(chalk.red(`✗ Quick command '${name}' not found`));
      return;
    }

    if (args.length !== command.parameters.length) {
      console.error(chalk.red(`✗ Expected ${command.parameters.length} arguments, got ${args.length}`));
      console.log(`Usage: vlet quick call ${name} ${command.parameters.join(' ')}`);
      return;
    }

    try {
      console.log(chalk.blue(`Executing quick command '${name}'...`));
      console.log(`${chalk.gray('Parameters:')} ${command.parameters.map((p, i) => `${p}=${args[i]}`).join(', ')}`);
      
      const expandedCommand = wm.getQuickCommandManager().executeQuickCommand(name, args);
      console.log(`${chalk.gray('Expanded:')} ${expandedCommand}`);

      // Parse expanded command to get wallet alias for password
      const parts = expandedCommand.split(' ');
      let walletAlias = '';
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i] === 'call' || parts[i] === 'send') {
          walletAlias = parts[i + 1];
          break;
        }
      }

      if (walletAlias && !wm.getWallet(walletAlias)) {
        const password = await PasswordManager.getWalletPassword(walletAlias, options.password);
        await wm.loadWallet(walletAlias, password);
      }

      const tx = await wm.executeQuickCommand(name, args);
      
      console.log(chalk.green('✓ Transaction sent successfully'));
      console.log(`${chalk.blue('Transaction Hash:')} ${tx.hash}`);
      
      if (options.wait) {
        console.log(chalk.blue('Waiting for confirmation...'));
        const receipt = await tx.wait();
        console.log(chalk.green('✓ Transaction confirmed'));
        console.log(`${chalk.blue('Block Number:')} ${receipt.blockNumber}`);
        console.log(`${chalk.blue('Gas Used:')} ${receipt.gasUsed.toString()}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to execute quick command: ${error}`));
    }
  });

quickCmd
  .command('remove <name>')
  .description('Remove a quick command')
  .option('-f, --force', 'Force removal without confirmation')
  .action((name: string, options) => {
    const wm = initWalletManager();
    const command = wm.getQuickCommand(name);
    
    if (!command) {
      console.error(chalk.red(`✗ Quick command '${name}' not found`));
      return;
    }

    if (!options.force) {
      console.log(chalk.yellow(`⚠ This will permanently delete quick command '${name}':`));
      console.log(`  ${chalk.gray('Parameters:')} ${command.parameters.join(', ')}`);
      console.log(`  ${chalk.gray('Template:')} ${command.template}`);
      console.log(chalk.yellow('Use --force flag to confirm removal'));
      return;
    }

    const success = wm.removeQuickCommand(name);
    if (success) {
      console.log(chalk.green(`✓ Quick command '${name}' removed successfully`));
    } else {
      console.error(chalk.red(`✗ Failed to remove quick command '${name}'`));
    }
  });

// Contract management
const contractCmd = program
  .command('contract')
  .description('Manage contract aliases')
  .action(() => {
    contractCmd.help();
  });

contractCmd
  .command('add <alias> <address>')
  .description('Add a contract alias')
  .option('-n, --name <name>', 'Contract name')
  .option('-d, --description <desc>', 'Contract description')
  .option('--network <network>', 'Contract network')
  .option('--abi <abi>', 'Contract ABI JSON file path')
  .action((alias: string, address: string, options) => {
    const wm = initWalletManager();
    
    if (wm.hasContract(alias)) {
      console.error(chalk.red(`✗ Contract alias '${alias}' already exists`));
      return;
    }

    try {
      let abi;
      if (options.abi) {
        if (!fs.existsSync(options.abi)) {
          console.error(chalk.red(`✗ ABI file not found: ${options.abi}`));
          return;
        }
        const abiData = fs.readFileSync(options.abi, 'utf8');
        abi = JSON.parse(abiData);
      }

      wm.addContract(alias, address, {
        name: options.name,
        description: options.description,
        network: options.network,
        abi
      });
      
      console.log(chalk.green(`✓ Contract alias '${alias}' added successfully`));
      console.log(`${chalk.blue('Address:')} ${address}`);
      if (options.name) {
        console.log(`${chalk.blue('Name:')} ${options.name}`);
      }
      if (options.description) {
        console.log(`${chalk.blue('Description:')} ${options.description}`);
      }
      if (options.network) {
        console.log(`${chalk.blue('Network:')} ${options.network}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to add contract: ${error}`));
    }
  });

contractCmd
  .command('list')
  .description('List all contract aliases')
  .action(() => {
    const wm = initWalletManager();
    const contracts = wm.listContracts();
    
    if (contracts.length === 0) {
      console.log(chalk.yellow('No contract aliases found'));
      return;
    }

    console.log(chalk.blue('\n=== Contract Aliases ==='));
    contracts.forEach(contract => {
      console.log(`${chalk.green('•')} ${contract.alias}`);
      console.log(`  ${chalk.gray('Address:')} ${contract.address}`);
      if (contract.name) {
        console.log(`  ${chalk.gray('Name:')} ${contract.name}`);
      }
      if (contract.description) {
        console.log(`  ${chalk.gray('Description:')} ${contract.description}`);
      }
      if (contract.network) {
        console.log(`  ${chalk.gray('Network:')} ${contract.network}`);
      }
      console.log(`  ${chalk.gray('Created:')} ${new Date(contract.createdAt).toLocaleString()}`);
      console.log();
    });
  });

contractCmd
  .command('info <alias>')
  .description('Show contract information')
  .action((alias: string) => {
    const wm = initWalletManager();
    const contract = wm.getContract(alias);
    
    if (!contract) {
      console.error(chalk.red(`✗ Contract alias '${alias}' not found`));
      return;
    }

    console.log(chalk.blue(`\n=== Contract: ${alias} ===`));
    console.log(`${chalk.green('Address:')} ${contract.address}`);
    if (contract.name) {
      console.log(`${chalk.green('Name:')} ${contract.name}`);
    }
    if (contract.description) {
      console.log(`${chalk.green('Description:')} ${contract.description}`);
    }
    if (contract.network) {
      console.log(`${chalk.green('Network:')} ${contract.network}`);
    }
    if (contract.abi) {
      console.log(`${chalk.green('ABI:')} Available (${contract.abi.length} functions/events)`);
    }
    console.log(`${chalk.green('Created:')} ${new Date(contract.createdAt).toLocaleString()}`);
    console.log(`${chalk.green('Updated:')} ${new Date(contract.updatedAt).toLocaleString()}`);
  });

contractCmd
  .command('remove <alias>')
  .description('Remove a contract alias')
  .option('-f, --force', 'Force removal without confirmation')
  .action((alias: string, options) => {
    const wm = initWalletManager();
    const contract = wm.getContract(alias);
    
    if (!contract) {
      console.error(chalk.red(`✗ Contract alias '${alias}' not found`));
      return;
    }

    if (!options.force) {
      console.log(chalk.yellow(`⚠ This will permanently delete contract alias '${alias}':`));
      console.log(`  ${chalk.gray('Address:')} ${contract.address}`);
      if (contract.name) {
        console.log(`  ${chalk.gray('Name:')} ${contract.name}`);
      }
      console.log(chalk.yellow('Use --force flag to confirm removal'));
      return;
    }

    const success = wm.removeContract(alias);
    if (success) {
      console.log(chalk.green(`✓ Contract alias '${alias}' removed successfully`));
    } else {
      console.error(chalk.red(`✗ Failed to remove contract alias '${alias}'`));
    }
  });

contractCmd
  .command('update <alias>')
  .description('Update contract alias information')
  .option('-a, --address <address>', 'New contract address')
  .option('-n, --name <name>', 'New contract name')
  .option('-d, --description <desc>', 'New contract description')
  .option('--network <network>', 'New contract network')
  .option('--abi <abi>', 'New contract ABI JSON file path')
  .action((alias: string, options) => {
    const wm = initWalletManager();
    
    if (!wm.hasContract(alias)) {
      console.error(chalk.red(`✗ Contract alias '${alias}' not found`));
      return;
    }

    try {
      const updates: any = {};
      
      if (options.address) updates.address = options.address;
      if (options.name) updates.name = options.name;
      if (options.description) updates.description = options.description;
      if (options.network) updates.network = options.network;
      
      if (options.abi) {
        if (!fs.existsSync(options.abi)) {
          console.error(chalk.red(`✗ ABI file not found: ${options.abi}`));
          return;
        }
        const abiData = fs.readFileSync(options.abi, 'utf8');
        updates.abi = JSON.parse(abiData);
      }

      if (Object.keys(updates).length === 0) {
        console.error(chalk.red('✗ No updates specified'));
        return;
      }

      const success = wm.updateContract(alias, updates);
      if (success) {
        console.log(chalk.green(`✓ Contract alias '${alias}' updated successfully`));
        const updated = wm.getContract(alias);
        if (updated) {
          console.log(`${chalk.blue('Address:')} ${updated.address}`);
          if (updated.name) console.log(`${chalk.blue('Name:')} ${updated.name}`);
          if (updated.description) console.log(`${chalk.blue('Description:')} ${updated.description}`);
          if (updated.network) console.log(`${chalk.blue('Network:')} ${updated.network}`);
        }
      } else {
        console.error(chalk.red(`✗ Failed to update contract alias '${alias}'`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to update contract: ${error}`));
    }
  });

// Wallet management commands (moved to top level)
program
  .command('create <alias>')
  .description('Create a new wallet')
  .option('-p, --password <password>', 'Wallet password (or use env: NEW_WALLET_PASSWORD)')
  .option('--hd-path <path>', 'HD derivation path for HD wallets')
  .option('--network <network>', 'Network for this wallet (overrides current network)')
  .option('--no-keystore', 'Skip saving keystore file')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    
    if (wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet with alias '${alias}' already exists`));
      return;
    }

    try {
      const password = await PasswordManager.getNewWalletPassword(alias, options.password);
      
      const wallet = await wm.createWallet({
        alias,
        password,
        hdPath: options.hdPath,
        network: options.network,
        saveKeystore: options.keystore !== false
      });
      
      console.log(chalk.green(`✓ Wallet '${alias}' created successfully`));
      console.log(`${chalk.blue('Address:')} ${wallet.address}`);
      console.log(`${chalk.blue('Network:')} ${wm.getWalletNetwork(alias)}`);
      if (options.hdPath) {
        console.log(`${chalk.blue('HD Path:')} ${options.hdPath}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to create wallet: ${error}`));
    }
  });

program
  .command('import <alias>')
  .description('Import a wallet')
  .option('-p, --password <password>', 'New wallet password (or use env: NEW_WALLET_PASSWORD)')
  .option('--private-key <key>', 'Private key to import')
  .option('--mnemonic <phrase>', 'Mnemonic phrase to import')
  .option('--keystore <file>', 'Keystore file to import')
  .option('--keystore-password <password>', 'Keystore file password (or use env: KEYSTORE_PASSWORD)')
  .option('--network <network>', 'Network for this wallet (overrides current network)')
  .option('--no-save', 'Skip saving keystore file')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    
    if (wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet with alias '${alias}' already exists`));
      return;
    }

    try {
      let keystoreJson: string | undefined;
      let keystorePassword: string | undefined;
      
      if (options.keystore) {
        if (!fs.existsSync(options.keystore)) {
          console.error(chalk.red(`✗ Keystore file not found: ${options.keystore}`));
          return;
        }
        keystoreJson = fs.readFileSync(options.keystore, 'utf8');
        keystorePassword = await PasswordManager.getKeystorePassword(
          options.keystore, 
          options.keystorePassword
        );
      }

      const password = await PasswordManager.getNewWalletPassword(alias, options.password);

      const wallet = await wm.importWallet({
        alias,
        password,
        privateKey: options.privateKey,
        mnemonic: options.mnemonic,
        keystoreJson,
        keystorePassword,
        network: options.network,
        saveKeystore: options.save !== false
      });
      
      console.log(chalk.green(`✓ Wallet '${alias}' imported successfully`));
      console.log(`${chalk.blue('Address:')} ${wallet.address}`);
      console.log(`${chalk.blue('Network:')} ${wm.getWalletNetwork(alias)}`);
    } catch (error) {
      console.error(chalk.red(`✗ Failed to import wallet: ${error}`));
    }
  });

program
  .command('list')
  .description('List all wallets')
  .action(() => {
    const wm = initWalletManager();
    const wallets = wm.listWallets();
    const defaultAccount = wm.getDefaultAccount();
    
    if (wallets.length === 0) {
      console.log(chalk.yellow('No wallets found'));
      return;
    }

    console.log(chalk.blue('\n=== Wallets ==='));
    wallets.forEach(wallet => {
      const isDefault = wallet.alias === defaultAccount;
      console.log(`${chalk.green('•')} ${wallet.alias}${isDefault ? chalk.cyan(' (default)') : ''}`);
      console.log(`  ${chalk.gray('Address:')} ${wallet.address}`);
      console.log(`  ${chalk.gray('Network:')} ${wallet.network || 'current'}`);
      console.log(`  ${chalk.gray('HD Wallet:')} ${wallet.isHD ? 'Yes' : 'No'}`);
      if (wallet.hdPath) {
        console.log(`  ${chalk.gray('HD Path:')} ${wallet.hdPath}`);
      }
      if (wallet.keystorePath) {
        console.log(`  ${chalk.gray('Keystore:')} ${wallet.keystorePath}`);
      }
      console.log();
    });
  });

program
  .command('info <alias>')
  .description('Show wallet information')
  .option('--show-private-key', 'Show private key (requires password)')
  .option('-p, --password <password>', 'Wallet password (required if showing private key)')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    const info = wm.getWalletInfo(alias);
    
    if (!info) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    const defaultAccount = wm.getDefaultAccount();
    const isDefault = alias === defaultAccount;

    console.log(chalk.blue(`\n=== Wallet: ${alias}${isDefault ? chalk.cyan(' (default)') : ''} ===`));
    console.log(`${chalk.green('Address:')} ${info.address}`);
    console.log(`${chalk.green('Network:')} ${info.network || 'current'}`);
    console.log(`${chalk.green('HD Wallet:')} ${info.isHD ? 'Yes' : 'No'}`);
    if (info.hdPath) {
      console.log(`${chalk.green('HD Path:')} ${info.hdPath}`);
    }
    if (info.keystorePath) {
      console.log(`${chalk.green('Keystore:')} ${info.keystorePath}`);
    }

    if (options.showPrivateKey) {
      try {
        const password = await PasswordManager.getWalletPassword(alias, options.password);
        const wallet = await wm.loadWallet(alias, password);
        console.log(`${chalk.red('Private Key:')} ${wallet.privateKey}`);
        console.log(chalk.yellow('⚠ Keep your private key secure and never share it with anyone!'));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to load wallet: ${error}`));
      }
    }
  });

program
  .command('remove [alias]')
  .description('Remove wallet(s)')
  .option('-f, --force', 'Force removal without confirmation')
  .option('-a, --all', 'Remove all wallets')
  .action(async (alias: string | undefined, options) => {
    const wm = initWalletManager();
    
    if (options.all) {
      const wallets = wm.listWallets();
      
      if (wallets.length === 0) {
        console.log(chalk.yellow('No wallets found to remove'));
        return;
      }

      if (!options.force) {
        console.log(chalk.yellow(`⚠ This will permanently delete ${wallets.length} wallet(s) and their keystore files:`));
        wallets.forEach(wallet => {
          console.log(chalk.yellow(`  • ${wallet.alias} (${wallet.address})`));
        });
        console.log(chalk.yellow('Use --force flag to confirm removal'));
        return;
      }

      console.log(chalk.blue(`Removing ${wallets.length} wallet(s)...`));
      let removed = 0;
      let failed = 0;

      for (const wallet of wallets) {
        const success = wm.removeWallet(wallet.alias);
        if (success) {
          console.log(chalk.green(`✓ Removed wallet '${wallet.alias}'`));
          removed++;
        } else {
          console.error(chalk.red(`✗ Failed to remove wallet '${wallet.alias}'`));
          failed++;
        }
      }

      console.log(chalk.blue(`\nSummary: ${removed} removed, ${failed} failed`));
      return;
    }

    if (!alias) {
      console.error(chalk.red('✗ Please specify a wallet alias or use --all flag'));
      console.log('Usage: remove <alias> [--force]');
      console.log('       remove --all [--force]');
      return;
    }

    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    if (!options.force) {
      console.log(chalk.yellow(`⚠ This will permanently delete wallet '${alias}' and its keystore file`));
      console.log(chalk.yellow('Use --force flag to confirm removal'));
      return;
    }

    const success = wm.removeWallet(alias);
    if (success) {
      console.log(chalk.green(`✓ Wallet '${alias}' removed successfully`));
    } else {
      console.error(chalk.red(`✗ Failed to remove wallet '${alias}'`));
    }
  });

program
  .command('sign-message <alias> <message>')
  .description('Sign a message with wallet')
  .option('-p, --password <password>', 'Wallet password (or use env: WALLET_PASSWORD)')
  .action(async (alias: string, message: string, options) => {
    const wm = initWalletManager();
    
    try {
      const password = await PasswordManager.getWalletPassword(alias, options.password);
      await wm.loadWallet(alias, password);
      const signature = await wm.signMessage(alias, message);
      
      console.log(chalk.green('✓ Message signed successfully'));
      console.log(`${chalk.blue('Message:')} ${message}`);
      console.log(`${chalk.blue('Signature:')} ${signature}`);
    } catch (error) {
      console.error(chalk.red(`✗ Failed to sign message: ${error}`));
    }
  });

program
  .command('set-network <alias> <network>')
  .description('Set network for a specific wallet')
  .action((alias: string, network: string) => {
    const wm = initWalletManager();
    
    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    const success = wm.setWalletNetwork(alias, network);
    if (success) {
      console.log(chalk.green(`✓ Network updated to '${network}' for wallet '${alias}'`));
    } else {
      console.error(chalk.red(`✗ Failed to update network for wallet '${alias}'`));
    }
  });

program
  .command('update-password <alias>')
  .description('Update wallet password')
  .option('--old-password <password>', 'Current wallet password (or use env: WALLET_PASSWORD)')
  .option('--new-password <password>', 'New wallet password (or use env: NEW_WALLET_PASSWORD)')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    
    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    try {
      const oldPassword = await PasswordManager.getWalletPassword(alias, options.oldPassword);
      const newPassword = await PasswordManager.getNewWalletPassword(alias, options.newPassword);
      
      await wm.updateWalletPassword(alias, oldPassword, newPassword);
      
      console.log(chalk.green(`✓ Password updated successfully for wallet '${alias}'`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to update password: ${error}`));
    }
  });

program
  .command('call <alias> <contract-address> <method-signature> [args...]')
  .description('Call a contract method with specified wallet')
  .option('-p, --password <password>', 'Wallet password (or use env: WALLET_PASSWORD)')
  .option('--rpc-url <url>', 'RPC URL to use for the call')
  .option('--gas-limit <limit>', 'Gas limit for the transaction')
  .option('--gas-price <price>', 'Gas price in gwei')
  .option('--value <amount>', 'ETH amount to send with the call')
  .option('--wait', 'Wait for transaction confirmation')
  .action(async (alias: string, contractAddress: string, methodSignature: string, args: string[], options) => {
    const wm = initWalletManager();
    
    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    try {
      const password = await PasswordManager.getWalletPassword(alias, options.password);
      await wm.loadWallet(alias, password);
      
      console.log(chalk.blue(`Calling contract method...`));
      console.log(`${chalk.gray('Wallet:')} ${alias}`);
      console.log(`${chalk.gray('Contract:')} ${contractAddress}`);
      console.log(`${chalk.gray('Method:')} ${methodSignature}`);
      console.log(`${chalk.gray('Args:')} ${args.join(', ')}`);
      if (options.rpcUrl) {
        console.log(`${chalk.gray('RPC URL:')} ${options.rpcUrl}`);
      }

      const tx = await wm.callContract(
        alias,
        contractAddress,
        methodSignature,
        args,
        options.rpcUrl,
        {
          gasLimit: options.gasLimit,
          gasPrice: options.gasPrice,
          value: options.value
        }
      );

      console.log(chalk.green('✓ Transaction sent successfully'));
      console.log(`${chalk.blue('Transaction Hash:')} ${tx.hash}`);
      
      if (options.wait) {
        console.log(chalk.blue('Waiting for confirmation...'));
        const receipt = await tx.wait();
        console.log(chalk.green('✓ Transaction confirmed'));
        console.log(`${chalk.blue('Block Number:')} ${receipt.blockNumber}`);
        console.log(`${chalk.blue('Gas Used:')} ${receipt.gasUsed.toString()}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to call contract: ${error}`));
    }
  });

program
  .command('send <alias> <contract-address> <method-signature> [args...]')
  .description('Send transaction to contract (alias for call)')
  .option('-p, --password <password>', 'Wallet password (or use env: WALLET_PASSWORD)')
  .option('--rpc-url <url>', 'RPC URL to use for the call')
  .option('--gas-limit <limit>', 'Gas limit for the transaction')
  .option('--gas-price <price>', 'Gas price in gwei')
  .option('--value <amount>', 'ETH amount to send with the call')
  .option('--wait', 'Wait for transaction confirmation')
  .action(async (alias: string, contractAddress: string, methodSignature: string, args: string[], options) => {
    const wm = initWalletManager();
    
    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    try {
      const password = await PasswordManager.getWalletPassword(alias, options.password);
      await wm.loadWallet(alias, password);
      
      console.log(chalk.blue(`Sending transaction...`));
      console.log(`${chalk.gray('Wallet:')} ${alias}`);
      console.log(`${chalk.gray('Contract:')} ${contractAddress}`);
      console.log(`${chalk.gray('Method:')} ${methodSignature}`);
      console.log(`${chalk.gray('Args:')} ${args.join(', ')}`);
      if (options.rpcUrl) {
        console.log(`${chalk.gray('RPC URL:')} ${options.rpcUrl}`);
      }

      const tx = await wm.callContract(
        alias,
        contractAddress,
        methodSignature,
        args,
        options.rpcUrl,
        {
          gasLimit: options.gasLimit,
          gasPrice: options.gasPrice,
          value: options.value
        }
      );

      console.log(chalk.green('✓ Transaction sent successfully'));
      console.log(`${chalk.blue('Transaction Hash:')} ${tx.hash}`);
      
      if (options.wait) {
        console.log(chalk.blue('Waiting for confirmation...'));
        const receipt = await tx.wait();
        console.log(chalk.green('✓ Transaction confirmed'));
        console.log(`${chalk.blue('Block Number:')} ${receipt.blockNumber}`);
        console.log(`${chalk.blue('Gas Used:')} ${receipt.gasUsed.toString()}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to send transaction: ${error}`));
    }
  });

// Command aliases for better user experience
program
  .command('new <alias>')
  .description('Create a new wallet (alias for create)')
  .option('-p, --password <password>', 'Wallet password (or use env: NEW_WALLET_PASSWORD)')
  .option('--hd-path <path>', 'HD derivation path for HD wallets')
  .option('--network <network>', 'Network for this wallet (overrides current network)')
  .option('--no-keystore', 'Skip saving keystore file')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    
    if (wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet with alias '${alias}' already exists`));
      return;
    }

    try {
      const password = await PasswordManager.getNewWalletPassword(alias, options.password);
      
      const wallet = await wm.createWallet({
        alias,
        password,
        hdPath: options.hdPath,
        network: options.network,
        saveKeystore: options.keystore !== false
      });
      
      console.log(chalk.green(`✓ Wallet '${alias}' created successfully`));
      console.log(`${chalk.blue('Address:')} ${wallet.address}`);
      console.log(`${chalk.blue('Network:')} ${wm.getWalletNetwork(alias)}`);
      if (options.hdPath) {
        console.log(`${chalk.blue('HD Path:')} ${options.hdPath}`);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to create wallet: ${error}`));
    }
  });

program
  .command('load <alias>')
  .description('Import a wallet (alias for import)')
  .option('-p, --password <password>', 'New wallet password (or use env: NEW_WALLET_PASSWORD)')
  .option('--private-key <key>', 'Private key to import')
  .option('--mnemonic <phrase>', 'Mnemonic phrase to import')
  .option('--keystore <file>', 'Keystore file to import')
  .option('--keystore-password <password>', 'Keystore file password (or use env: KEYSTORE_PASSWORD)')
  .option('--network <network>', 'Network for this wallet (overrides current network)')
  .option('--no-save', 'Skip saving keystore file')
  .action(async (alias: string, options) => {
    const wm = initWalletManager();
    
    if (wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet with alias '${alias}' already exists`));
      return;
    }

    try {
      let keystoreJson: string | undefined;
      let keystorePassword: string | undefined;
      
      if (options.keystore) {
        if (!fs.existsSync(options.keystore)) {
          console.error(chalk.red(`✗ Keystore file not found: ${options.keystore}`));
          return;
        }
        keystoreJson = fs.readFileSync(options.keystore, 'utf8');
        keystorePassword = await PasswordManager.getKeystorePassword(
          options.keystore, 
          options.keystorePassword
        );
      }

      const password = await PasswordManager.getNewWalletPassword(alias, options.password);

      const wallet = await wm.importWallet({
        alias,
        password,
        privateKey: options.privateKey,
        mnemonic: options.mnemonic,
        keystoreJson,
        keystorePassword,
        network: options.network,
        saveKeystore: options.save !== false
      });
      
      console.log(chalk.green(`✓ Wallet '${alias}' imported successfully`));
      console.log(`${chalk.blue('Address:')} ${wallet.address}`);
      console.log(`${chalk.blue('Network:')} ${wm.getWalletNetwork(alias)}`);
    } catch (error) {
      console.error(chalk.red(`✗ Failed to import wallet: ${error}`));
    }
  });

program
  .command('delete [alias]')
  .description('Remove wallet(s) (alias for remove)')
  .option('-f, --force', 'Force removal without confirmation')
  .option('-a, --all', 'Remove all wallets')
  .action(async (alias: string | undefined, options) => {
    const wm = initWalletManager();
    
    if (options.all) {
      const wallets = wm.listWallets();
      
      if (wallets.length === 0) {
        console.log(chalk.yellow('No wallets found to remove'));
        return;
      }

      if (!options.force) {
        console.log(chalk.yellow(`⚠ This will permanently delete ${wallets.length} wallet(s) and their keystore files:`));
        wallets.forEach(wallet => {
          console.log(chalk.yellow(`  • ${wallet.alias} (${wallet.address})`));
        });
        console.log(chalk.yellow('Use --force flag to confirm removal'));
        return;
      }

      console.log(chalk.blue(`Removing ${wallets.length} wallet(s)...`));
      let removed = 0;
      let failed = 0;

      for (const wallet of wallets) {
        const success = wm.removeWallet(wallet.alias);
        if (success) {
          console.log(chalk.green(`✓ Removed wallet '${wallet.alias}'`));
          removed++;
        } else {
          console.error(chalk.red(`✗ Failed to remove wallet '${wallet.alias}'`));
          failed++;
        }
      }

      console.log(chalk.blue(`\nSummary: ${removed} removed, ${failed} failed`));
      return;
    }

    if (!alias) {
      console.error(chalk.red('✗ Please specify a wallet alias or use --all flag'));
      console.log('Usage: delete <alias> [--force]');
      console.log('       delete --all [--force]');
      return;
    }

    if (!wm.hasWallet(alias)) {
      console.error(chalk.red(`✗ Wallet '${alias}' not found`));
      return;
    }

    if (!options.force) {
      console.log(chalk.yellow(`⚠ This will permanently delete wallet '${alias}' and its keystore file`));
      console.log(chalk.yellow('Use --force flag to confirm removal'));
      return;
    }

    const success = wm.removeWallet(alias);
    if (success) {
      console.log(chalk.green(`✓ Wallet '${alias}' removed successfully`));
    } else {
      console.error(chalk.red(`✗ Failed to remove wallet '${alias}'`));
    }
  });

// Error handling
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage()
});

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('Error:'), error.message);
  console.log('\nFor help, run:');
  console.log(chalk.blue('  ethers-wallet-manager --help'));
  console.log(chalk.blue('  ethers-wallet-manager <command> --help'));
});