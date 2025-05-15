const { exec } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Check for full backup flag
const fullBackup = process.argv.includes('--full');

// Validate required environment variables
const requiredVars = ['POSTGRES_DB', 'POSTGRES_USER', 'BACKUP_REGION', 'BACKUP_BUCKET_NAME'];
for (const varName of requiredVars) {
    if (!process.env[varName]) {
        console.error(`Error: ${varName} environment variable is required`);
        process.exit(1);
    }
}

const { 
    POSTGRES_DB: dbName,
    POSTGRES_USER: dbUser,
    BACKUP_REGION: awsRegion,
    BACKUP_BUCKET_NAME: bucketName
} = process.env;

const dateString = new Date().toISOString();
const backupType = fullBackup ? 'full' : 'default';
const gzFileName = `./backups/${dateString}${fullBackup ? '-full' : ''}.sql.gz`;

console.log(`Starting ${backupType} backup process for database ${dbName}...`);

async function createBackup() {
    // Build pg_dump command
    const dumpArgs = [
        `-U ${dbUser}`,
        `-d ${dbName}`,
        '--clean',
        '--create',
        '--if-exists'
    ];

    // Only exclude table if not doing full backup
    if (!fullBackup) {
        dumpArgs.push('--exclude-table-data=public.directus_revisions');
    }

    const dumpCommand = `pg_dump ${dumpArgs.join(' ')}`;
    const fullCommand = `docker exec directus_postgres bash -c "${dumpCommand} | gzip -9" > ${gzFileName}`;

    console.log(`Executing: ${fullCommand}`);

    return new Promise((resolve, reject) => {
        const backupProcess = exec(fullCommand, { maxBuffer: 1024 * 1024 * 50 });

        backupProcess.on('error', (err) => {
            console.error('Process error:', err);
            cleanupFailedBackup();
            reject(err);
        });

        backupProcess.on('close', async (code, signal) => {
            if (code !== 0) {
                console.error(`✗ Backup failed with code ${code} and signal ${signal}`);
                cleanupFailedBackup();
                reject(new Error(`Backup process failed with code ${code}`));
                return;
            }

            const fileSizeMB = (fs.statSync(gzFileName).size / 1024 / 1024).toFixed(2);
            console.log(`✓ ${backupType} backup created: ${gzFileName} (${fileSizeMB} MB)`);
        });
    });
}

// Run the backup
createBackup()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Backup failed:', err);
        process.exit(1);
    });

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, terminating...');
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, terminating...');
    process.exit(1);
});
