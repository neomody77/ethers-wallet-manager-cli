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

export class WalletManager {
  private wallets: Map<string, ManagedWallet> = new Map();
  private walletInfo: Map<string, WalletInfo> = new Map();
  private configManager: ConfigManager;
  private keystoreDir: string;
  private defaultNetwork: string;
  private currentNetwork: string;

  constructor(config: WalletManagerConfig = {}) {
    this.configManager = new ConfigManager(config.configDir);
    
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
}