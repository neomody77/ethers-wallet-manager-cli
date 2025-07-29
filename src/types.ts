import { Wallet, HDNodeWallet } from 'ethers';

export interface WalletInfo {
  alias: string;
  address: string;
  keystorePath?: string;
  isHD?: boolean;
  hdPath?: string;
  network?: string;
}

export interface KeystoreData {
  address: string;
  crypto: any;
  id: string;
  version: number;
}

export interface WalletManagerConfig {
  keystoreDir?: string;
  defaultNetwork?: string;
  configDir?: string;
}

export interface ConfigFile {
  keystoreDir: string;
  defaultNetwork: string;
  currentNetwork: string;
  defaultAccount?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletOptions {
  alias: string;
  password: string;
  saveKeystore?: boolean;
  hdPath?: string;
  network?: string;
}

export interface ImportWalletOptions {
  alias: string;
  password: string;
  privateKey?: string;
  mnemonic?: string;
  keystoreJson?: string;
  keystorePassword?: string;
  saveKeystore?: boolean;
  network?: string;
}

export type ManagedWallet = Wallet | HDNodeWallet;

export interface QuickCommand {
  name: string;
  parameters: string[];
  template: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickCommandsFile {
  commands: { [name: string]: QuickCommand };
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractInfo {
  alias: string;
  address: string;
  name?: string;
  description?: string;
  network?: string;
  abi?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractsFile {
  contracts: { [alias: string]: ContractInfo };
  version: string;
  createdAt: string;
  updatedAt: string;
}