import * as fs from 'fs';
import * as path from 'path';
import { ContractInfo, ContractsFile } from './types';

export class ContractManager {
  private configDir: string;
  private contractsPath: string;
  private defaultContracts: ContractsFile;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.contractsPath = path.join(configDir, 'contracts.json');
    
    this.defaultContracts = {
      contracts: {},
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ensureConfigDir();
    this.initializeContracts();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private initializeContracts(): void {
    if (!fs.existsSync(this.contractsPath)) {
      this.saveContracts(this.defaultContracts);
    }
  }

  getContracts(): ContractsFile {
    try {
      const data = fs.readFileSync(this.contractsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to read contracts file, using defaults:', error);
      return this.defaultContracts;
    }
  }

  saveContracts(contracts: Partial<ContractsFile>): void {
    const currentContracts = this.getContracts();
    const updatedContracts: ContractsFile = {
      ...currentContracts,
      ...contracts,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.contractsPath, JSON.stringify(updatedContracts, null, 2));
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
    const contracts = this.getContracts();
    
    // Validate address format (basic check)
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error('Invalid contract address format');
    }

    contracts.contracts[alias] = {
      alias,
      address,
      name: options.name,
      description: options.description,
      network: options.network,
      abi: options.abi,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveContracts(contracts);
  }

  getContract(alias: string): ContractInfo | undefined {
    const contracts = this.getContracts();
    return contracts.contracts[alias];
  }

  listContracts(): ContractInfo[] {
    const contracts = this.getContracts();
    return Object.values(contracts.contracts);
  }

  listContractAliases(): string[] {
    const contracts = this.getContracts();
    return Object.keys(contracts.contracts);
  }

  hasContract(alias: string): boolean {
    const contracts = this.getContracts();
    return alias in contracts.contracts;
  }

  removeContract(alias: string): boolean {
    const contracts = this.getContracts();
    
    if (!contracts.contracts[alias]) {
      return false;
    }

    delete contracts.contracts[alias];
    this.saveContracts(contracts);
    return true;
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
    const contracts = this.getContracts();
    const contract = contracts.contracts[alias];
    
    if (!contract) {
      return false;
    }

    // Validate address if provided
    if (updates.address && (!updates.address.startsWith('0x') || updates.address.length !== 42)) {
      throw new Error('Invalid contract address format');
    }

    contracts.contracts[alias] = {
      ...contract,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveContracts(contracts);
    return true;
  }

  resolveAddress(aliasOrAddress: string): string {
    // If it's already an address, return as-is
    if (aliasOrAddress.startsWith('0x') && aliasOrAddress.length === 42) {
      return aliasOrAddress;
    }

    // Try to resolve as alias
    const contract = this.getContract(aliasOrAddress);
    if (contract) {
      return contract.address;
    }

    // Return original if not found (could be invalid address)
    return aliasOrAddress;
  }

  resetContracts(): void {
    const resetContracts = {
      ...this.defaultContracts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.saveContracts(resetContracts);
  }

  exportContracts(filePath: string): void {
    const contracts = this.getContracts();
    fs.writeFileSync(filePath, JSON.stringify(contracts, null, 2));
  }

  importContracts(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Contracts file not found: ${filePath}`);
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const importedContracts = JSON.parse(data);
      
      // Validate required fields
      if (!importedContracts.contracts || typeof importedContracts.contracts !== 'object') {
        throw new Error('Invalid contracts file: missing contracts object');
      }

      this.saveContracts(importedContracts);
    } catch (error) {
      throw new Error(`Failed to import contracts: ${error}`);
    }
  }
}