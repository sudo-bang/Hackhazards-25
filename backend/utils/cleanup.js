import fs from 'fs/promises';

export async function cleanupFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) {
        console.log("Cleanup: No files provided to delete.");
        return;
    }

    console.log("Cleanup: Attempting to delete temporary files:", filePaths);
    const cleanupPromises = filePaths.map(filePath => {
        if (filePath) {
            return fs.unlink(filePath)
                .then(() => console.log(`Cleanup: Deleted ${filePath}`))
                .catch(err => console.error(`Cleanup Error: Failed to delete ${filePath}:`, err.message));
        }
        return Promise.resolve();
    });

    await Promise.allSettled(cleanupPromises);
    console.log("Cleanup: Finished cleanup attempts.");
}

