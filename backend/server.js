import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import utilities
import { ensureUploadsDirectory, upload } from './utils/fileHandler.js';
import { extractAudio, extractKeyFrames } from './utils/videoProcessor.js';
import { transcribeAudio } from './utils/audioProcessor.js';
import { summarizeVideoContent, summarizeAudioContent } from './utils/groqProcessor.js';
import { cleanupFiles } from './utils/cleanup.js';

// --- Configuration ---
dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

// --- Read Frame Extraction Configuration ---
const DEFAULT_SECONDS_PER_FRAME = 10;
const DEFAULT_MAX_FRAMES = 30;

let secondsPerFrame = DEFAULT_SECONDS_PER_FRAME;
if (process.env.VIDEO_SECONDS_PER_FRAME) {
    const parsedSeconds = parseInt(process.env.VIDEO_SECONDS_PER_FRAME, 10);
    if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        secondsPerFrame = parsedSeconds;
    }
}

let maxFrames = DEFAULT_MAX_FRAMES;
if (process.env.MAX_VIDEO_FRAMES) {
    const parsedMax = parseInt(process.env.MAX_VIDEO_FRAMES, 10);
    if (!isNaN(parsedMax) && parsedMax > 0) {
        maxFrames = parsedMax;
    }
}
const frameExtractionConfig = { secondsPerFrame, maxFrames };

// --- End Frame Extraction Configuration ---


// Ensure Groq API key is available on startup
if (!process.env.GROQ_API_KEY) {
    console.error("FATAL ERROR: GROQ_API_KEY is not set in the .env file.");
    process.exit(1);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Ensure Uploads Directory on Startup ---
ensureUploadsDirectory();

// --- Main Route ---
app.post('/summarize', upload.single('mediaFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalFilePath = req.file.path;
    const mimeType = req.file.mimetype;
    console.log(`ROUTE: Received file: ${req.file.originalname}, Type: ${mimeType}, Path: ${originalFilePath}`);

    let filesToCleanup = [originalFilePath];
    let audioPathForTranscription = null;
    let isVideo = false;

    try {
        let transcriptText = null;
        let base64Frames = [];
        let summaryResult = null;

        if (mimeType.startsWith('video/')) {
            isVideo = true;
            console.log("ROUTE: Video detected. Processing...");
            let tempAudioPath = null;
            try {
                tempAudioPath = await extractAudio(originalFilePath);
                filesToCleanup.push(tempAudioPath);
                audioPathForTranscription = tempAudioPath;

                base64Frames = await extractKeyFrames(originalFilePath, frameExtractionConfig);
                console.log(`ROUTE: Successfully extracted ${base64Frames.length} frames.`);

            } catch (extractionError) {
                 console.warn("ROUTE: Error during video extraction:", extractionError.message);
                 if (!audioPathForTranscription && tempAudioPath) {
                     audioPathForTranscription = tempAudioPath;
                     console.warn("ROUTE: Proceeding with audio only due to frame extraction failure.");
                 } else if (!audioPathForTranscription && !tempAudioPath){
                     throw new Error(`Critical video processing error: ${extractionError.message}`);
                 }
                 base64Frames = [];
            }

        } else if (mimeType.startsWith('audio/')) {
            console.log("ROUTE: Audio detected. Processing...");
            isVideo = false;
            audioPathForTranscription = originalFilePath;
        } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }

        if (!audioPathForTranscription) {
            throw new Error("Could not determine audio file path for transcription.");
        }
        console.log(`ROUTE: Transcribing audio from: ${audioPathForTranscription}`);
        transcriptText = await transcribeAudio(audioPathForTranscription);
        if (!transcriptText || transcriptText.trim().length === 0) {
            throw new Error("Transcription resulted in empty text.");
        }
        console.log("ROUTE: Transcription successful.");

        if (isVideo && base64Frames.length > 0) {
            console.log("ROUTE: Calling Groq Vision summarizer...");
            summaryResult = await summarizeVideoContent(transcriptText, base64Frames);
        } else {
            console.log("ROUTE: Calling Groq Text summarizer...");
            summaryResult = await summarizeAudioContent(transcriptText);
        }
        console.log(`ROUTE: Groq summary received using model ${summaryResult.modelUsed}.`);

        res.json({ summary: summaryResult.summary, modelUsed: summaryResult.modelUsed });

    } catch (error) {
        console.error('ROUTE: Error during summarization process:', error);
        res.status(500).json({
             error: 'Failed to process file.',
             details: error.message || 'An unknown server error occurred.'
        });
    } finally {
        await cleanupFiles(filesToCleanup);
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log("Ensure ffmpeg is installed and accessible in your PATH.");
});
