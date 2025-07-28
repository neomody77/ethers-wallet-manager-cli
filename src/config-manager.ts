import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigFile } from './types';

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private defaultConfig: ConfigFile;

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(os.homedir(), '.ethereum-wallets');
    this.configPath = path.join(this.configDir, 'config.json');
    
    this.defaultConfig = {
      keystoreDir: path.join(this.configDir, 'keystores'),
      defaultNetwork: 'mainnet',
      currentNetwork: 'mainnet',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ensureConfigDir();
    this.initializeConfig();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private initializeConfig(): void {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.defaultConfig);
    }
  }

  getConfig(): ConfigFile {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to read config file, using defaults:', error);
      return this.defaultConfig;
    }
  }

  saveConfig(config: Partial<ConfigFile>): void {
    const currentConfig = this.getConfig();
    const updatedConfig: ConfigFile = {
      ...currentConfig,
      ...config,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(updatedConfig, null, 2));
  }

  updateKeystoreDir(newDir: string): void {
    const expandedDir = newDir.startsWith('~') 
      ? path.join(os.homedir(), newDir.slice(1))
      : path.resolve(newDir);
    
    this.saveConfig({ keystoreDir: expandedDir });
  }

  updateDefaultNetwork(network: string): void {
    this.saveConfig({ defaultNetwork: network });
  }

  updateCurrentNetwork(network: string): void {
    this.saveConfig({ currentNetwork: network });
  }

  getKeystoreDir(): string {
    return this.getConfig().keystoreDir;
  }

  getDefaultNetwork(): string {
    return this.getConfig().defaultNetwork;
  }

  getCurrentNetwork(): string {
    return this.getConfig().currentNetwork;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  resetConfig(): void {
    const resetConfig = {
      ...this.defaultConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.saveConfig(resetConfig);
  }

  exportConfig(filePath: string): void {
    const config = this.getConfig();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  }

  importConfig(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const importedConfig = JSON.parse(data);
      
      // Validate required fields
      if (!importedConfig.keystoreDir || !importedConfig.defaultNetwork) {
        throw new Error('Invalid config file: missing required fields');
      }

      this.saveConfig(importedConfig);
    } catch (error) {
      throw new Error(`Failed to import config: ${error}`);
    }
  }
}