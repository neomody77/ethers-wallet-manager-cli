# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to `dist/` directory
- **Development CLI**: `npm run cli` - Run CLI using ts-node directly from source
- **Development Example**: `npm run dev` - Runs example.ts with ts-node
- **Production Start**: `npm start` - Runs compiled CLI from dist/

## Architecture Overview

This is an Ethereum wallet management CLI tool built with TypeScript, ethers.js, and Commander.js.

### Core Components

- **WalletManager** (`src/wallet-manager.ts`): Main class handling wallet operations (create, import, sign, etc.)
- **ConfigManager** (`src/config-manager.ts`): Manages persistent configuration in `~/.ethereum-wallets/config.json`
- **QuickCommandManager** (`src/quick-command-manager.ts`): Manages command templates with parameter substitution
- **ContractManager** (`src/contract-manager.ts`): Manages contract aliases and address resolution
- **CLI Interface** (`src/cli.ts`): Commander.js-based CLI with comprehensive wallet management commands
- **Types** (`src/types.ts`): TypeScript interfaces for wallet info, config, and options

### Data Storage

- **Configuration**: `~/.ethereum-wallets/config.json` (managed by ConfigManager)
- **Wallet Info**: `~/.ethereum-wallets/keystores/wallet-info.json` (wallet metadata)
- **Keystore Files**: `~/.ethereum-wallets/keystores/` (encrypted wallet files with format: `{alias}-{timestamp}-{randomId}.json`)
- **Quick Commands**: `~/.ethereum-wallets/quick-commands.json` (command templates)
- **Contract Aliases**: `~/.ethereum-wallets/contracts.json` (contract address mappings)

### Key Architecture Patterns

1. **Wallet Management**: Uses Map-based in-memory wallet storage with persistent keystore files
2. **Password Handling**: PasswordManager utility handles secure password input and environment variable support
3. **Configuration**: Hierarchical config system with constructor overrides > config file > defaults
4. **Error Handling**: Comprehensive error messages with chalk-colored output
5. **Command Aliases**: Primary commands have user-friendly aliases (create/new, import/load, remove/delete)

### CLI Command Structure

Commands are organized as:
- Top-level wallet operations: create, import, list, info, remove, sign-message, set-network, update-password, call, send
- Config subcommands: `config show|set-keystore-dir|set-default-network|set-current-network|set-default-account|export|import|reset`
- Quick command management: `quick add|list|call|remove`
- Contract alias management: `contract add|list|info|remove|update`
- Command aliases for better UX: new, load, delete, send (alias for call)

### Contract Interaction

The CLI supports calling smart contract methods with the `call` and `send` commands:
- **call/send**: Execute contract methods with specified wallet, similar to `cast send`
- Supports method signatures like `"methodName(type1,type2)"`
- Optional parameters: --rpc-url, --gas-limit, --gas-price, --value, --wait
- Example: `vlet send my-wallet 0x123... "transfer(address,uint256)" 0xabc... 1000000000000000000 --rpc-url http://localhost:8545 --wait`

### Quick Commands

The CLI supports saving and reusing command templates with parameter substitution:
- **QuickCommandManager** (`src/quick-command-manager.ts`): Manages command templates with parameter substitution
- **Storage**: `~/.ethereum-wallets/quick-commands.json`
- **Parameter Substitution**: Use `$paramName` in templates, replaced with provided arguments

#### Quick Command Usage
```bash
# Add a quick command template
vlet quick add mint "amount recipient" "call my-wallet 0x123... \"mint(uint256,address)\" \$amount \$recipient --rpc-url http://localhost:8545"

# List all quick commands
vlet quick list

# Execute a quick command
vlet quick call mint 1000000000000000000 0xabc...

# Remove a quick command
vlet quick remove mint --force
```

#### Parameter Detection
- Parameters can be explicitly specified: `"amount recipient"`
- Or auto-detected from template using `$paramName` syntax
- Template parsing handles quoted strings and command-line options

### Contract Alias Management

The CLI supports contract aliases for easier contract interaction:
- **ContractManager** (`src/contract-manager.ts`): Manages contract address mappings and metadata
- **Storage**: `~/.ethereum-wallets/contracts.json`
- **Auto-resolution**: Both `call`/`send` and `quick call` commands automatically resolve contract aliases to addresses

#### Contract Alias Usage
```bash
# Add contract alias
vlet contract add token 0x123456789abcdef --name "MyToken" --description "ERC-20 token contract"

# List all contract aliases
vlet contract list

# Show contract info
vlet contract info token

# Update contract alias
vlet contract update token --name "UpdatedToken" --network mainnet

# Remove contract alias
vlet contract remove token --force

# Use alias in contract calls
vlet call my-wallet token "transfer(address,uint256)" 0xabc... 1000

# Use alias in quick commands
vlet quick add transfer-token "amount to" "call my-wallet token 'transfer(address,uint256)' \$to \$amount"
vlet quick call transfer-token 1000 0xdef...
```

#### Contract Alias Features
- **Address Resolution**: Automatically resolves aliases to addresses in all contract calls
- **Metadata Storage**: Store contract name, description, network, and ABI
- **ABI Support**: Import contract ABI from JSON files for enhanced functionality
- **Network Tagging**: Associate contracts with specific networks
- **Validation**: Address format validation on add/update operations

### Network Support

- Default networks: mainnet, goerli, sepolia, polygon
- Custom RPC endpoints supported
- Per-wallet network configuration with fallback to current/default network

### Binary Names

The CLI is available as both:
- `ethers-wallet-manager` (full name)
- `vlet` (short alias)