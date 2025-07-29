import { Wallet, HDNodeWallet, ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  WalletInfo,
  KeystoreData,
  WalletManagerConfig,
  CreateWalletOptions,
  ImportWalletOptions,
  ManagedWallet
} from './types';
import { ConfigManager } from './config-manager';
import { QuickCommandManager } from './quick-command-manager';
import { ContractManager } from './contract-manager';

export class WalletManager {
  private wallets: Map<string, ManagedWallet> = new Map();
  private walletInfo: Map<string, WalletInfo> = new Map();
  private configManager: ConfigManager;
  private quickCommandManager: QuickCommandManager;
  private contractManager: ContractManager;
  private keystoreDir: string;
  private defaultNetwork: string;
  private currentNetwork: string;

  constructor(config: WalletManagerConfig = {}) {
    this.configManager = new ConfigManager(config.configDir);
    this.quickCommandManager = new QuickCommandManager(this.configManager.getConfigDir());
    this.contractManager = new ContractManager(this.configManager.getConfigDir());
    
    // Override config file settings if provided in constructor
    if (config.keystoreDir) {
      this.configManager.updateKeystoreDir(config.keystoreDir);
    }
    if (config.defaultNetwork) {
      this.configManager.updateDefaultNetwork(config.defaultNetwork);
    }

    this.keystoreDir = this.configManager.getKeystoreDir();
    this.defaultNetwork = this.configManager.getDefaultNetwork();
    this.currentNetwork = this.configManager.getCurrentNetwork();
    
    this.ensureKeystoreDir();
    this.loadWalletInfo();
  }

  private ensureKeystoreDir(): void {
    if (!fs.existsSync(this.keystoreDir)) {
      fs.mkdirSync(this.keystoreDir, { recursive: true });
    }
  }

  private loadWalletInfo(): void {
    const infoPath = path.join(this.keystoreDir, 'wallet-info.json');
    if (fs.existsSync(infoPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        this.walletInfo = new Map(Object.entries(data));
      } catch (error) {
        console.warn('Failed to load wallet info:', error);
      }
    }
  }

  private saveWalletInfo(): void {
    const infoPath = path.join(this.keystoreDir, 'wallet-info.json');
    const data = Object.fromEntries(this.walletInfo);
    fs.writeFileSync(infoPath, JSON.stringify(data, null, 2));
  }

  private generateKeystorePath(alias: string): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    return path.join(this.keystoreDir, `${alias}-${timestamp}-${randomId}.json`);
  }

  async createWallet(options: CreateWalletOptions): Promise<ManagedWallet> {
    if (this.walletInfo.has(options.alias)) {
      throw new Error(`Wallet with alias '${options.alias}' already exists`);
    }

    let wallet: ManagedWallet;
    
    if (options.hdPath) {
      const mnemonic = ethers.Wallet.createRandom().mnemonic;
      if (!mnemonic) throw new Error('Failed to generate mnemonic');
      wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, options.hdPath);
    } else {
      wallet = ethers.Wallet.createRandom();
    }

    const walletInfo: WalletInfo = {
      alias: options.alias,
      address: wallet.address,
      isHD: !!options.hdPath,
      hdPath: options.hdPath,
      network: options.network || this.currentNetwork
    };

    if (options.saveKeystore !== false) {
      const keystorePath = this.generateKeystorePath(options.alias);
      const keystore = await wallet.encrypt(options.password);
      fs.writeFileSync(keystorePath, keystore);
      walletInfo.keystorePath = keystorePath;
    }

    this.wallets.set(options.alias, wallet);
    this.walletInfo.set(options.alias, walletInfo);
    this.saveWalletInfo();

    return wallet;
  }

  async importWallet(options: ImportWalletOptions): Promise<ManagedWallet> {
    if (this.walletInfo.has(options.alias)) {
      throw new Error(`Wallet with alias '${options.alias}' already exists`);
    }

    let wallet: ManagedWallet;

    if (options.privateKey) {
      wallet = new ethers.Wallet(options.privateKey);
    } else if (options.mnemonic) {
      const hdPath = "m/44'/60'/0'/0/0"; // Default Ethereum path
      wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(options.mnemonic), hdPath);
    } else if (options.keystoreJson && options.keystorePassword) {
      wallet = await ethers.Wallet.fromEncryptedJson(options.keystoreJson, options.keystorePassword);
    } else {
      throw new Error('Must provide privateKey, mnemonic, or keystore data');
    }

    const walletInfo: WalletInfo = {
      alias: options.alias,
      address: wallet.address,
      isHD: options.mnemonic ? true : false,
      network: options.network || this.currentNetwork
    };

    if (options.saveKeystore !== false) {
      const keystorePath = this.generateKeystorePath(options.alias);
      const keystore = await wallet.encrypt(options.password);
      fs.writeFileSync(keystorePath, keystore);
      walletInfo.keystorePath = keystorePath;
    }

    this.wallets.set(options.alias, wallet);
    this.walletInfo.set(options.alias, walletInfo);
    this.saveWalletInfo();

    return wallet;
  }

  async loadWallet(alias: string, password: string): Promise<ManagedWallet> {
    if (this.wallets.has(alias)) {
      return this.wallets.get(alias)!;
    }

    const info = this.walletInfo.get(alias);
    if (!info || !info.keystorePath) {
      throw new Error(`Wallet '${alias}' not found or has no keystore`);
    }

    if (!fs.existsSync(info.keystorePath)) {
      throw new Error(`Keystore file not found: ${info.keystorePath}`);
    }

    const keystoreJson = fs.readFileSync(info.keystorePath, 'utf8');
    const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
    
    this.wallets.set(alias, wallet);
    return wallet;
  }

  getWallet(alias: string): ManagedWallet | undefined {
    return this.wallets.get(alias);
  }

  getWalletInfo(alias: string): WalletInfo | undefined {
    return this.walletInfo.get(alias);
  }

  listWallets(): WalletInfo[] {
    return Array.from(this.walletInfo.values());
  }

  listWalletAliases(): string[] {
    return Array.from(this.walletInfo.keys());
  }

  hasWallet(alias: string): boolean {
    return this.walletInfo.has(alias);
  }

  removeWallet(alias: string): boolean {
    const info = this.walletInfo.get(alias);
    if (!info) return false;

    // Remove from memory
    this.wallets.delete(alias);
    this.walletInfo.delete(alias);

    // Remove keystore file if it exists
    if (info.keystorePath && fs.existsSync(info.keystorePath)) {
      fs.unlinkSync(info.keystorePath);
    }

    this.saveWalletInfo();
    return true;
  }

  async updateWalletPassword(alias: string, oldPassword: string, newPassword: string): Promise<void> {
    const info = this.walletInfo.get(alias);
    if (!info || !info.keystorePath) {
      throw new Error(`Wallet '${alias}' not found or has no keystore`);
    }

    // Load wallet with old password
    const wallet = await this.loadWallet(alias, oldPassword);
    
    // Create new keystore with new password
    const newKeystore = await wallet.encrypt(newPassword);
    fs.writeFileSync(info.keystorePath, newKeystore);
  }

  async signMessage(alias: string, message: string): Promise<string> {
    const wallet = this.getWallet(alias);
    if (!wallet) {
      throw new Error(`Wallet '${alias}' not loaded. Call loadWallet first.`);
    }
    return await wallet.signMessage(message);
  }

  async signTransaction(alias: string, transaction: any): Promise<string> {
    const wallet = this.getWallet(alias);
    if (!wallet) {
      throw new Error(`Wallet '${alias}' not loaded. Call loadWallet first.`);
    }
    return await wallet.signTransaction(transaction);
  }

  connectToProvider(alias: string, provider: ethers.Provider): ManagedWallet {
    const wallet = this.getWallet(alias);
    if (!wallet) {
      throw new Error(`Wallet '${alias}' not loaded. Call loadWallet first.`);
    }
    const connectedWallet = wallet.connect(provider);
    this.wallets.set(alias, connectedWallet as ManagedWallet);
    return connectedWallet as ManagedWallet;
  }

  async callContract(
    alias: string, 
    contractAddress: string, 
    methodSignature: string, 
    args: any[], 
    rpcUrl?: string,
    options: { gasLimit?: string; gasPrice?: string; value?: string } = {}
  ): Promise<any> {
    const wallet = this.getWallet(alias);
    if (!wallet) {
      throw new Error(`Wallet '${alias}' not loaded. Call loadWallet first.`);
    }

    // Resolve contract address from alias if needed
    const resolvedContractAddress = this.contractManager.resolveAddress(contractAddress);

    // Create provider
    const provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : ethers.getDefaultProvider();
    const connectedWallet = wallet.connect(provider);

    // Parse method signature to get function fragment
    const functionFragment = ethers.FunctionFragment.from(methodSignature);
    
    // Create contract interface
    const contractInterface = new ethers.Interface([functionFragment]);
    
    // Create contract instance
    const contract = new ethers.Contract(resolvedContractAddress, contractInterface, connectedWallet);
    
    // Prepare transaction options
    const txOptions: any = {};
    if (options.gasLimit) txOptions.gasLimit = BigInt(options.gasLimit);
    if (options.gasPrice) txOptions.gasPrice = ethers.parseUnits(options.gasPrice, 'gwei');
    if (options.value) txOptions.value = ethers.parseEther(options.value);

    // Call the contract method
    const methodName = functionFragment.name;
    const tx = await contract[methodName](...args, txOptions);
    
    return tx;
  }

  // Configuration management methods
  getConfig() {
    return this.configManager.getConfig();
  }

  updateKeystoreDir(newDir: string): void {
    this.configManager.updateKeystoreDir(newDir);
    this.keystoreDir = this.configManager.getKeystoreDir();
    this.ensureKeystoreDir();
  }

  updateDefaultNetwork(network: string): void {
    this.configManager.updateDefaultNetwork(network);
    this.defaultNetwork = this.configManager.getDefaultNetwork();
  }

  updateCurrentNetwork(network: string): void {
    this.configManager.updateCurrentNetwork(network);
    this.currentNetwork = this.configManager.getCurrentNetwork();
  }

  setWalletNetwork(alias: string, network: string): boolean {
    const info = this.walletInfo.get(alias);
    if (!info) return false;
    
    info.network = network;
    this.walletInfo.set(alias, info);
    this.saveWalletInfo();
    return true;
  }

  getKeystoreDir(): string {
    return this.keystoreDir;
  }

  getDefaultNetwork(): string {
    return this.defaultNetwork;
  }

  getCurrentNetwork(): string {
    return this.currentNetwork;
  }

  updateDefaultAccount(alias: string): void {
    this.configManager.updateDefaultAccount(alias);
  }

  getDefaultAccount(): string | undefined {
    return this.configManager.getDefaultAccount();
  }

  getWalletNetwork(alias: string): string {
    const info = this.getWalletInfo(alias);
    return info?.network || this.currentNetwork;
  }

  getConfigDir(): string {
    return this.configManager.getConfigDir();
  }

  exportConfig(filePath: string): void {
    this.configManager.exportConfig(filePath);
  }

  importConfig(filePath: string): void {
    this.configManager.importConfig(filePath);
    // Reload settings after import
    this.keystoreDir = this.configManager.getKeystoreDir();
    this.defaultNetwork = this.configManager.getDefaultNetwork();
    this.currentNetwork = this.configManager.getCurrentNetwork();
    this.ensureKeystoreDir();
    this.loadWalletInfo();
  }

  resetConfig(): void {
    this.configManager.resetConfig();
    this.keystoreDir = this.configManager.getKeystoreDir();
    this.defaultNetwork = this.configManager.getDefaultNetwork();
    this.currentNetwork = this.configManager.getCurrentNetwork();
    this.ensureKeystoreDir();
  }

  // Quick command management methods
  getQuickCommandManager(): QuickCommandManager {
    return this.quickCommandManager;
  }

  addQuickCommand(name: string, parameters: string[], template: string, description?: string): void {
    this.quickCommandManager.addQuickCommand(name, parameters, template, description);
  }

  listQuickCommands() {
    return this.quickCommandManager.listQuickCommands();
  }

  getQuickCommand(name: string) {
    return this.quickCommandManager.getQuickCommand(name);
  }

  removeQuickCommand(name: string): boolean {
    return this.quickCommandManager.removeQuickCommand(name);
  }

  async executeQuickCommand(name: string, args: string[]): Promise<any> {
    const expandedCommand = this.quickCommandManager.executeQuickCommand(name, args);
    
    // Parse the expanded command to extract call components
    // Expected format: "call <alias> <contract> <method> [args...] [options...]"
    const parts = this.parseQuickCommand(expandedCommand);
    
    // Resolve wallet and contract aliases to addresses
    const resolvedWalletAlias = parts.alias; // Keep wallet alias as-is for authentication
    const resolvedContractAddress = this.contractManager.resolveAddress(parts.contractAddress);
    
    return await this.callContract(
      resolvedWalletAlias,
      resolvedContractAddress,
      parts.methodSignature,
      parts.args,
      parts.rpcUrl,
      parts.options
    );
  }

  private parseQuickCommand(command: string): {
    alias: string;
    contractAddress: string;
    methodSignature: string;
    args: string[];
    rpcUrl?: string;
    options: { gasLimit?: string; gasPrice?: string; value?: string };
  } {
    // Simple parsing - split by spaces and handle quoted strings
    const parts = this.parseCommandLine(command);
    
    if (parts.length < 4) {
      throw new Error('Invalid quick command format. Expected: call <alias> <contract> <method> [args...]');
    }

    // Skip 'call' if present
    let startIndex = 0;
    if (parts[0] === 'call' || parts[0] === 'send') {
      startIndex = 1;
    }

    const alias = parts[startIndex];
    const contractAddress = parts[startIndex + 1];
    const methodSignature = parts[startIndex + 2];
    
    // Extract args and options
    const remainingParts = parts.slice(startIndex + 3);
    const args: string[] = [];
    const options: { gasLimit?: string; gasPrice?: string; value?: string } = {};
    let rpcUrl: string | undefined;

    for (let i = 0; i < remainingParts.length; i++) {
      const part = remainingParts[i];
      
      if (part === '--rpc-url' && i + 1 < remainingParts.length) {
        rpcUrl = remainingParts[i + 1];
        i++; // Skip next part
      } else if (part === '--gas-limit' && i + 1 < remainingParts.length) {
        options.gasLimit = remainingParts[i + 1];
        i++; // Skip next part
      } else if (part === '--gas-price' && i + 1 < remainingParts.length) {
        options.gasPrice = remainingParts[i + 1];
        i++; // Skip next part
      } else if (part === '--value' && i + 1 < remainingParts.length) {
        options.value = remainingParts[i + 1];
        i++; // Skip next part
      } else if (!part.startsWith('--')) {
        args.push(part);
      }
    }

    return {
      alias,
      contractAddress,
      methodSignature,
      args,
      rpcUrl,
      options
    };
  }

  private parseCommandLine(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  // Contract management methods
  getContractManager(): ContractManager {
    return this.contractManager;
  }

  addContract(
    alias: string, 
    address: string, 
    options: {
      name?: string;
      description?: string;
      network?: string;
      abi?: any[];
    } = {}
  ): void {
    this.contractManager.addContract(alias, address, options);
  }

  listContracts() {
    return this.contractManager.listContracts();
  }

  getContract(alias: string) {
    return this.contractManager.getContract(alias);
  }

  hasContract(alias: string): boolean {
    return this.contractManager.hasContract(alias);
  }

  removeContract(alias: string): boolean {
    return this.contractManager.removeContract(alias);
  }

  updateContract(
    alias: string, 
    updates: {
      address?: string;
      name?: string;
      description?: string;
      network?: string;
      abi?: any[];
    }
  ): boolean {
    return this.contractManager.updateContract(alias, updates);
  }

  resolveContractAddress(aliasOrAddress: string): string {
    return this.contractManager.resolveAddress(aliasOrAddress);
  }
}