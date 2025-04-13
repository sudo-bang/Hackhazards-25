import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
    console.error("FATAL ERROR: GROQ_API_KEY is not set. Cannot initialize GroqProcessor.");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL_IMAGE_LIMIT = 5;

export async function summarizeVideoContent(transcript, base64Frames) {
    const modelForFinalSummary = TEXT_MODEL;
    console.log(`GROQ_PROC(Video-Multi): Processing ${base64Frames.length} frames in chunks of ${VISION_MODEL_IMAGE_LIMIT}...`);

    if (!transcript) {
        throw new Error("Transcript is required for video summarization.");
    }

    const partialAnalyses = [];
    const numFrames = base64Frames.length;

    if (numFrames === 0) {
        console.log("GROQ_PROC(Video-Multi): No frames provided. Falling back to text-only summary.");
        return await summarizeAudioContent(transcript);
    }

    const numChunks = Math.ceil(numFrames / VISION_MODEL_IMAGE_LIMIT);
    console.log(`GROQ_PROC(Video-Multi): Will process in ${numChunks} chunk(s).`);

    for (let i = 0; i < numChunks; i++) {
        const chunkIndex = i + 1;
        const start = i * VISION_MODEL_IMAGE_LIMIT;
        const end = start + VISION_MODEL_IMAGE_LIMIT;
        const currentChunkFrames = base64Frames.slice(start, end);
        const frameNumbers = `Frames ${start + 1}-${Math.min(end, numFrames)}`;

        if (currentChunkFrames.length === 0) continue;

        console.log(`GROQ_PROC(Video-Multi): Analyzing Chunk ${chunkIndex}/${numChunks} (${frameNumbers}, ${currentChunkFrames.length} frames) using ${VISION_MODEL}...`);

        const userMessages = [
            {
                type: "text",
                text: `This is analysis part ${chunkIndex} of ${numChunks}. Analyze the key visual information in the following ${currentChunkFrames.length} frame(s) (${frameNumbers}). Use the full audio transcript provided below ONLY for context about what might be happening visually. Focus your response on describing what is visible in these specific frames.\n\nFull Transcript for Context:\n${transcript}`
            }
        ];

        currentChunkFrames.forEach((base64Data) => {
             if (typeof base64Data === 'string' && base64Data.startsWith('data:image/jpeg;base64,')) {
                userMessages.push({ type: "image_url", image_url: { url: base64Data } });
             } else { console.warn(`GROQ_PROC(Video-Multi): Skipping invalid frame data in chunk ${chunkIndex}.`); }
        });

        const visionPayload = {
            model: VISION_MODEL,
            messages: [
                { role: "system", content: `You are an AI analyzing a segment of video frames (${frameNumbers}) using the full transcript for context. Describe visual elements.` },
                { role: "user", content: userMessages }
            ],
            max_tokens: 768
        };

        try {
            const completion = await groq.chat.completions.create(visionPayload);
            const analysisText = completion.choices[0]?.message?.content?.trim();
            if (analysisText) {
                partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: analysisText });
                console.log(`GROQ_PROC(Video-Multi): Analysis received for Chunk ${chunkIndex}.`);
            } else {
                console.warn(`GROQ_PROC(Video-Multi): Received empty analysis for Chunk ${chunkIndex}. Storing placeholder.`);
                partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: "[Analysis for this segment was empty]" });
            }
        } catch (error) {
            console.error(`GROQ_PROC(Video-Multi): Error analyzing Chunk ${chunkIndex} (${frameNumbers}) using ${VISION_MODEL}:`, error.message);
            partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: `[Error during analysis: ${error.message}]` });
        }
    }

    const successfulAnalyses = partialAnalyses.filter(pa => !pa.analysis.startsWith("[Error") && !pa.analysis.startsWith("[Analysis for this segment was empty]"));

    if (successfulAnalyses.length === 0) {
         console.warn("GROQ_PROC(Video-Multi): No successful partial analyses generated from frames. Falling back to text-only summary.");
         return await summarizeAudioContent(transcript);
    }

    console.log(`GROQ_PROC(Video-Multi): Synthesizing ${successfulAnalyses.length} partial visual analyses with transcript using ${modelForFinalSummary}...`);

    let combinedAnalyses = "";
    successfulAnalyses.forEach(pa => {
        combinedAnalyses += `\nAnalysis of ${pa.frameRange}:\n${pa.analysis}\n---`;
    });

    const synthesisPrompt = `Generate a comprehensive summary of the video based on the full audio transcript and the following sequential analyses of key visual frame segments.\n\nFull Audio Transcript:\n${transcript}\n\nVisual Segment Analyses:${combinedAnalyses}\n\nFinal Comprehensive Summary:`;

    const synthesisPayload = {
        model: modelForFinalSummary,
        messages: [
            { role: "system", content: "You are an expert AI assistant synthesizing a full transcript and multiple sequential analyses of video frame segments into a single, coherent summary." },
            { role: "user", content: synthesisPrompt }
        ],
        max_tokens: 1536
    };

    try {
        const finalCompletion = await groq.chat.completions.create(synthesisPayload);
        const finalSummary = finalCompletion.choices[0]?.message?.content?.trim();
        if (!finalSummary) {
            throw new Error("Final synthesis resulted in an empty summary.");
        }
        console.log("GROQ_PROC(Video-Multi): Final synthesis successful.");
        return { summary: finalSummary, modelUsed: modelForFinalSummary };
    } catch (error) {
         console.error(`GROQ_PROC(Video-Multi): Error during final synthesis (${modelForFinalSummary}):`, error);
         throw new Error(`Final summary synthesis failed: ${error.message}`);
    }
}

export async function summarizeAudioContent(transcript) {
    const modelUsed = TEXT_MODEL;
    console.log(`GROQ_PROC(Audio): Preparing text request for Groq model: ${modelUsed}`);

     if (!transcript || transcript.trim().length === 0) {
         console.warn("GROQ_PROC(Audio): Attempted to summarize empty or invalid transcript.");
         return { summary: "[No transcript provided or transcript was empty]", modelUsed: modelUsed };
    }

    const payload = {
        model: modelUsed,
        messages: [
            { role: "system", content: "You are an expert at summarizing audio transcripts concisely." },
            { role: "user", content: `Please provide a concise summary of the following transcript:\n\n${transcript}` }
        ],
        max_tokens: 512
    };

    console.log(`GROQ_PROC(Audio): Sending request to Groq (${modelUsed})...`);
    try {
        const completion = await groq.chat.completions.create(payload);
        const summary = completion.choices[0]?.message?.content?.trim();
        if (!summary) {
             console.warn(`GROQ_PROC(Audio): Groq API returned empty summary for text.`);
             return { summary: "[Summary generation failed or returned empty]", modelUsed: modelUsed };
        }
        console.log("GROQ_PROC(Audio): Groq Text processing successful.");
        return { summary: summary, modelUsed: modelUsed };
    } catch (error) {
        console.error(`GROQ_PROC(Audio): Groq API Error (${modelUsed}):`, error);
        throw new Error(`Groq API request failed (${modelUsed}) for text summary: ${error.message}`);
    }
}

