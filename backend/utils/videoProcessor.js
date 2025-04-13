import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs/promises';
import path from 'path';
import { uploadsDir } from './fileHandler.js';

// Set ffmpeg paths immediately
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// --- extractAudio function remains the same ---
export function extractAudio(videoPath) {
    const audioFilename = `${path.basename(videoPath)}.mp3`;
    const audioPath = path.join(path.dirname(videoPath), audioFilename);

    return new Promise((resolve, reject) => {
        console.log(`Attempting to extract audio from ${videoPath} to ${audioPath}`);
        ffmpeg(videoPath)
            .noVideo().audioCodec('libmp3lame').audioBitrate('128k').output(audioPath)
            .on('end', () => { console.log('Audio extraction finished.'); resolve(audioPath); })
            .on('error', (err) => { console.error('Error extracting audio:', err.message); reject(new Error(`ffmpeg audio extraction failed: ${err.message}`)); })
            .run();
    });
}


/**
 * Extracts key frames based on video length and configuration.
 * @param {string} videoPath Path to the video file.
 * @param {object} config Configuration object.
 * @param {number} config.secondsPerFrame Interval between frames in seconds.
 * @param {number} config.maxFrames Maximum number of frames to extract.
 * @returns {Promise<string[]>} Array of base64 encoded image strings.
 */
export async function extractKeyFrames(videoPath, { secondsPerFrame, maxFrames }) { 
    const frameDir = path.join(uploadsDir, `frames-${path.basename(videoPath)}-${Date.now()}`);
    await fs.mkdir(frameDir);
    console.log(`VID_PROCESS: Extracting 1 frame/${secondsPerFrame}s (max ${maxFrames}) from ${videoPath} to ${frameDir}`);

    return new Promise((resolve, reject) => {
        let duration;
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                fs.rm(frameDir, { recursive: true, force: true }).catch(cleanupErr => console.error("VID_PROCESS: Cleanup error on ffprobe failure:", cleanupErr));
                return reject(new Error(`ffprobe error: ${err.message}`));
            }
            duration = metadata.format.duration;
            if (!duration || duration <= 0) {
                fs.rm(frameDir, { recursive: true, force: true }).catch(cleanupErr => console.error("VID_PROCESS: Cleanup error on invalid duration:", cleanupErr));
                return reject(new Error("Could not determine video duration or duration is zero."));
            }

            let calculatedFrameCount = Math.floor(duration / secondsPerFrame);
            if (calculatedFrameCount <= 0 && duration > 0.1) { 
                 calculatedFrameCount = 1; 
            } else if (calculatedFrameCount <= 0) {
                 calculatedFrameCount = 0;
            }

            let actualFrameCount = Math.min(calculatedFrameCount, maxFrames); 

            if (actualFrameCount <= 0) {
                 console.log("VID_PROCESS: Calculated frame count is zero or less based on duration/interval/max. Skipping frame extraction.");
                 fs.rmdir(frameDir).catch(cleanupErr => console.error("VID_PROCESS: Cleanup error on zero frames:", cleanupErr));
                 return resolve([]); 
            }

            const timemarks = [];
            for (let i = 1; i <= actualFrameCount; i++) {
                const timestamp = i * secondsPerFrame;
                if (timestamp <= duration + 0.5) { 
                    timemarks.push(Math.min(timestamp, duration)); 
                } else {
                    break; 
                }
            }

            if (timemarks.length === 0 && duration > 0.1) {
                const midPoint = Math.max(0.1, duration / 2); 
                timemarks.push(midPoint);
                actualFrameCount = 1; 
                console.log(`VID_PROCESS: Video shorter than interval (${secondsPerFrame}s). Grabbing single frame near ${midPoint.toFixed(1)}s.`);
            } else {
                 actualFrameCount = timemarks.length; 
            }

            console.log(`VID_PROCESS: Duration: ${duration.toFixed(1)}s. Calculated: ${calculatedFrameCount} frames. Limited to: ${maxFrames}. Actual frames to extract: ${actualFrameCount} at times: ${timemarks.map(t => t.toFixed(1)).join(', ')}s`);

            if (actualFrameCount === 0) {
                 console.log("VID_PROCESS: No valid timestamps generated. Skipping frame extraction.");
                 fs.rmdir(frameDir).catch(cleanupErr => console.error("VID_PROCESS: Cleanup error on zero timestamps:", cleanupErr));
                 return resolve([]);
            }

            const framePaths = []; 

            ffmpeg(videoPath)
                .on('end', async () => {
                    console.log(`VID_PROCESS: ${actualFrameCount} frames extracted successfully to file system.`);
                    const base64Frames = [];
                    try {
                        for (let i = 1; i <= actualFrameCount; i++) {
                            const frameFilename = `frame-${i}.jpg`; 
                            const framePath = path.join(frameDir, frameFilename);
                            framePaths.push(framePath); 
                            try {
                                const fileBuffer = await fs.readFile(framePath);
                                base64Frames.push(`data:image/jpeg;base64,${fileBuffer.toString('base64')}`);
                            } catch (readError) {
                                console.warn(`VID_PROCESS: Could not read frame file ${framePath}: ${readError.message}`);
                            }
                        }
                        console.log(`VID_PROCESS: Encoded ${base64Frames.length} frames.`);
                        resolve(base64Frames);
                    } catch (processError) {
                        reject(new Error(`Error processing frame files: ${processError.message}`));
                    } finally {
                        try {
                            await Promise.all(framePaths.map(fp => fs.unlink(fp).catch(e => console.warn(`VID_PROCESS: Failed to delete frame ${fp}: ${e.message}`))));
                            await fs.rmdir(frameDir);
                            console.log("VID_PROCESS: Cleaned up temporary frame files and directory.");
                        } catch (cleanupErr) {
                            console.error("VID_PROCESS: Error during frame cleanup:", cleanupErr);
                        }
                    }
                })
                .on('error', async (err) => {
                    console.error('VID_PROCESS: Error during ffmpeg screenshots command:', err.message);
                    try {
                         await Promise.all(framePaths.map(fp => fs.unlink(fp).catch(e => console.warn(`VID_PROCESS: Failed to delete frame ${fp} on error: ${e.message}`))));
                         await fs.rmdir(frameDir).catch(()=>{}); 
                    } catch(cleanupErr) {
                         console.error("VID_PROCESS: Cleanup error on frame extraction failure:", cleanupErr);
                    }
                    reject(new Error(`ffmpeg frame extraction command failed: ${err.message}`));
                })
                .screenshots({
                    timemarks: timemarks, 
                    folder: frameDir,
                    filename: 'frame-%i.jpg' 
                });
        });
    });
}
