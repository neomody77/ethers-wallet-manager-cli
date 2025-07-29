import * as fs from 'fs';
import * as path from 'path';
import { QuickCommand, QuickCommandsFile } from './types';

export class QuickCommandManager {
  private configDir: string;
  private quickCommandsPath: string;
  private defaultQuickCommands: QuickCommandsFile;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.quickCommandsPath = path.join(configDir, 'quick-commands.json');
    
    this.defaultQuickCommands = {
      commands: {},
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.ensureConfigDir();
    this.initializeQuickCommands();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private initializeQuickCommands(): void {
    if (!fs.existsSync(this.quickCommandsPath)) {
      this.saveQuickCommands(this.defaultQuickCommands);
    }
  }

  getQuickCommands(): QuickCommandsFile {
    try {
      const data = fs.readFileSync(this.quickCommandsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to read quick commands file, using defaults:', error);
      return this.defaultQuickCommands;
    }
  }

  saveQuickCommands(quickCommands: Partial<QuickCommandsFile>): void {
    const currentCommands = this.getQuickCommands();
    const updatedCommands: QuickCommandsFile = {
      ...currentCommands,
      ...quickCommands,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.quickCommandsPath, JSON.stringify(updatedCommands, null, 2));
  }

  addQuickCommand(name: string, parameters: string[], template: string, description?: string): void {
    const quickCommands = this.getQuickCommands();
    
    quickCommands.commands[name] = {
      name,
      parameters,
      template,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveQuickCommands(quickCommands);
  }

  getQuickCommand(name: string): QuickCommand | undefined {
    const quickCommands = this.getQuickCommands();
    return quickCommands.commands[name];
  }

  listQuickCommands(): QuickCommand[] {
    const quickCommands = this.getQuickCommands();
    return Object.values(quickCommands.commands);
  }

  removeQuickCommand(name: string): boolean {
    const quickCommands = this.getQuickCommands();
    
    if (!quickCommands.commands[name]) {
      return false;
    }

    delete quickCommands.commands[name];
    this.saveQuickCommands(quickCommands);
    return true;
  }

  executeQuickCommand(name: string, args: string[]): string {
    const command = this.getQuickCommand(name);
    if (!command) {
      throw new Error(`Quick command '${name}' not found`);
    }

    if (args.length !== command.parameters.length) {
      throw new Error(`Expected ${command.parameters.length} arguments for '${name}', got ${args.length}`);
    }

    // Replace parameters in template
    let result = command.template;
    command.parameters.forEach((param, index) => {
      const placeholder = `$${param}`;
      result = result.replace(new RegExp(`\\${placeholder}`, 'g'), args[index]);
    });

    return result;
  }

  parseParametersFromTemplate(template: string): string[] {
    const paramRegex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const parameters: string[] = [];
    const seen = new Set<string>();
    
    let match;
    while ((match = paramRegex.exec(template)) !== null) {
      const param = match[1];
      if (!seen.has(param)) {
        parameters.push(param);
        seen.add(param);
      }
    }
    
    return parameters;
  }

  resetQuickCommands(): void {
    const resetCommands = {
      ...this.defaultQuickCommands,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.saveQuickCommands(resetCommands);
  }

  exportQuickCommands(filePath: string): void {
    const quickCommands = this.getQuickCommands();
    fs.writeFileSync(filePath, JSON.stringify(quickCommands, null, 2));
  }

  importQuickCommands(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Quick commands file not found: ${filePath}`);
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const importedCommands = JSON.parse(data);
      
      // Validate required fields
      if (!importedCommands.commands || typeof importedCommands.commands !== 'object') {
        throw new Error('Invalid quick commands file: missing commands object');
      }

      this.saveQuickCommands(importedCommands);
    } catch (error) {
      throw new Error(`Failed to import quick commands: ${error}`);
    }
  }
}