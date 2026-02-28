require('dotenv').config();
const { createBackup } = require('./db_backup_utils.cjs');

async function main() {
  try {
    console.log('📦 Iniciando backup do banco...');
    const backupFile = await createBackup('manual');
    console.log(`✅ Backup concluído: ${backupFile}`);
  } catch (error) {
    console.error(`❌ Falha no backup: ${error.message}`);
    process.exitCode = 1;
  }
}

main();

