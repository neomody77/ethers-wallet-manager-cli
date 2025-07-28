import { WalletManager, ConfigManager } from './index';
import { ethers } from 'ethers';
import * as os from 'os';
import * as path from 'path';

async function example() {
  console.log('=== Ethers Wallet Manager Configuration Demo ===\n');

  // Initialize wallet manager (will use config from ~/.ethers-wallet-manager/)
  const walletManager = new WalletManager();

  // Show current configuration
  console.log('Current configuration:');
  const config = walletManager.getConfig();
  console.log(`- Config directory: ${walletManager.getConfigDir()}`);
  console.log(`- Keystore directory: ${walletManager.getKeystoreDir()}`);
  console.log(`- Default network: ${walletManager.getDefaultNetwork()}`);
  console.log(`- Config version: ${config.version}`);
  console.log(`- Created at: ${config.createdAt}\n`);

  // Update keystore directory to a custom location
  const customKeystoreDir = path.join(os.homedir(), 'my-ethereum-wallets');
  console.log(`Updating keystore directory to: ${customKeystoreDir}`);
  walletManager.updateKeystoreDir(customKeystoreDir);
  walletManager.updateDefaultNetwork('sepolia');
  console.log(`New keystore directory: ${walletManager.getKeystoreDir()}`);
  console.log(`New default network: ${walletManager.getDefaultNetwork()}\n`);

  try {
    // Create a new wallet
    const wallet1 = await walletManager.createWallet({
      alias: 'my-main-wallet',
      password: 'secure-password-123',
      saveKeystore: true
    });
    console.log('Created wallet:', wallet1.address);

    // Create an HD wallet
    const hdWallet = await walletManager.createWallet({
      alias: 'my-hd-wallet',
      password: 'secure-password-456',
      saveKeystore: true,
      hdPath: "m/44'/60'/0'/0/0"
    });
    console.log('Created HD wallet:', hdWallet.address);

    // Import wallet from private key
    const importedWallet = await walletManager.importWallet({
      alias: 'imported-wallet',
      password: 'import-password',
      privateKey: '0x' + '1'.repeat(64), // Example private key
      saveKeystore: true
    });
    console.log('Imported wallet:', importedWallet.address);

    // List all wallets
    console.log('All wallets:');
    walletManager.listWallets().forEach(info => {
      console.log(`- ${info.alias}: ${info.address} (HD: ${info.isHD})`);
    });

    // Load a wallet from keystore
    const loadedWallet = await walletManager.loadWallet('my-main-wallet', 'secure-password-123');
    console.log('Loaded wallet:', loadedWallet.address);

    // Sign a message
    const message = 'Hello, Ethereum!';
    const signature = await walletManager.signMessage('my-main-wallet', message);
    console.log('Message signature:', signature);

    // Connect to a provider and prepare for transactions
    const provider = new ethers.JsonRpcProvider('https://goerli.infura.io/v3/YOUR_INFURA_KEY');
    const connectedWallet = walletManager.connectToProvider('my-main-wallet', provider);
    
    // Example transaction (uncomment to use)
    /*
    const tx = {
      to: '0x742d35Cc6634C0532925a3b8D72C2E5D93Cc8b29',
      value: ethers.parseEther('0.001'),
      gasLimit: 21000,
    };
    const signedTx = await walletManager.signTransaction('my-main-wallet', tx);
    console.log('Signed transaction:', signedTx);
    */

    // Demonstrate config export/import
    console.log('\n=== Configuration Export/Import Demo ===');
    const exportPath = './wallet-config-backup.json';
    walletManager.exportConfig(exportPath);
    console.log(`Configuration exported to: ${exportPath}`);

    // Reset config and then import it back
    console.log('Resetting configuration to defaults...');
    walletManager.resetConfig();
    console.log(`Keystore directory after reset: ${walletManager.getKeystoreDir()}`);
    
    console.log('Importing configuration from backup...');
    walletManager.importConfig(exportPath);
    console.log(`Keystore directory after import: ${walletManager.getKeystoreDir()}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
example();