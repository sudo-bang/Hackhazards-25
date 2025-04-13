import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsDir = path.join(__dirname, '..', 'uploads');

export async function ensureUploadsDirectory() {
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
        console.log(`Uploads directory ensured at: ${uploadsDir}`);
    } catch (err) {
        console.error("FATAL ERROR: Could not create uploads directory:", err);
        process.exit(1);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});
