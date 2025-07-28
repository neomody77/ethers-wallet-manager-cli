# Ethers Wallet Manager CLI

A powerful command-line interface for managing Ethereum wallets using ethers.js. Create, import, and manage multiple wallets with secure keystore encryption.

## Installation

Install globally via npm:

```bash
npm install -g ethers-wallet-manager
```

After installation, you can use either command:
- `ethers-wallet-manager` (full command)
- `vlet` (short alias)

## Features

- 🔐 **Secure Wallet Management**: Create and import wallets with encrypted keystore files
- 🎯 **Multiple Import Methods**: Support for private keys, mnemonic phrases, and keystore JSON
- 🌐 **Network Support**: Configure and switch between different Ethereum networks
- 📝 **HD Wallet Support**: Create hierarchical deterministic wallets with custom derivation paths
- 🔑 **Message & Transaction Signing**: Sign messages and transactions securely
- 🏷️ **Wallet Aliases**: Manage multiple wallets with easy-to-remember names
- ⚙️ **Configuration Management**: Persistent configuration with import/export functionality

## Quick Start

### Create a New Wallet
```bash
vlet create my-wallet --password mySecurePassword
# or use alias:
vlet new my-wallet --password mySecurePassword
```

### Import from Mnemonic
```bash
vlet import imported-wallet --mnemonic "your twelve word mnemonic phrase here" --password myPassword
# or use alias:
vlet load imported-wallet --mnemonic "your twelve word mnemonic phrase here" --password myPassword
```

### Import from Private Key
```bash
vlet import pk-wallet --private-key 0x1234... --password myPassword
# or use alias:
vlet load pk-wallet --private-key 0x1234... --password myPassword
```

### List All Wallets
```bash
vlet list
```

### Show Wallet Information
```bash
vlet info my-wallet
```

### Show Wallet Information with Private Key
```bash
vlet info my-wallet --show-private-key --password mySecurePassword
```

### Set Default Account
```bash
vlet config set-default-account my-wallet
```

### Remove a Wallet
```bash
vlet remove my-wallet --force
# or use alias:
vlet delete my-wallet --force
```

### Sign a Message
```bash
vlet sign-message my-wallet "Hello, World!" --password mySecurePassword
```

## Commands

**Wallet Management:**
- `create <alias>` / `new <alias>` - Create a new wallet
- `import <alias>` / `load <alias>` - Import an existing wallet
- `list` - Show all managed wallets
- `info <alias>` - Show wallet information
- `remove <alias>` / `delete <alias>` - Remove a wallet
- `sign-message <alias> <message>` - Sign a message with a wallet
- `set-network <alias> <network>` - Set network for a specific wallet
- `update-password <alias>` - Update wallet password

**Configuration:**
- `config show` - Show current configuration
- `config set-keystore-dir <directory>` - Set keystore directory
- `config set-default-network <network>` - Set default network
- `config set-current-network <network>` - Set current network
- `config set-default-account <alias>` - Set default account/wallet
- `config export <file>` - Export configuration
- `config import <file>` - Import configuration
- `config reset` - Reset to defaults

## Configuration

The CLI stores configuration and wallet data in:
- **Config**: `~/.ethers-wallet-manager/config.json`
- **Wallets**: `~/.ethers-wallet-manager/wallets/`

### Supported Networks
- Mainnet
- Goerli
- Sepolia
- Polygon
- Custom RPC endpoints

## Security Features

- **Encrypted Keystores**: All private keys are encrypted using industry-standard encryption
- **Password Protection**: Each wallet requires a password for access
- **Local Storage**: No data is transmitted to external servers
- **Secure Key Generation**: Uses cryptographically secure random number generation

## Development

### Build from Source
```bash
git clone https://github.com/neomody77/ethers-wallet-manager-cli.git
cd ethers-wallet-manager-cli
npm install
npm run build
```

### Run Development Version
```bash
npm run cli -- create --alias test-wallet
```

## API Usage

You can also use this as a library in your Node.js projects:

```typescript
import { WalletManager } from 'ethers-wallet-manager';

const manager = new WalletManager();

// Create a new wallet
const wallet = await manager.createWallet({
  alias: 'my-app-wallet',
  password: 'secure-password'
});

// Import existing wallet
const imported = await manager.importWallet({
  alias: 'imported-wallet',
  mnemonic: 'your mnemonic phrase here',
  password: 'password'
});
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/neomody77/ethers-wallet-manager-cli/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/neomody77/ethers-wallet-manager-cli/issues)
- 📚 **Documentation**: [GitHub Wiki](https://github.com/neomody77/ethers-wallet-manager-cli/wiki)

## Disclaimer

This software is provided "as is" without any warranty. Always backup your wallet files and never share your private keys or mnemonic phrases. The developers are not responsible for any loss of funds.