import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

// --- Configuration & Initialization ---
if (!process.env.GROQ_API_KEY) {
    console.error("FATAL ERROR: GROQ_API_KEY is not set.");
    // process.exit(1); // Or handle differently
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- Model Definitions (Verify these IDs from Groq Docs) ---
// Use the model you decided on (LLaVA or Llama Scout)
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
// Use a powerful text model for synthesis
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL_IMAGE_LIMIT = 5; // Max images per call to VISION_MODEL

/**
 * Generates Markdown documentation by analyzing video frame chunks
 * and synthesizing results with the transcript.
 * @param {string} transcript The audio transcript.
 * @param {string[]} base64Frames Array of base64 encoded image strings.
 * @returns {Promise<{summary: string, modelUsed: string}>} Contains final Markdown doc and the model used for synthesis.
 */
export async function summarizeVideoContent(transcript, base64Frames) {
    const modelForFinalSynthesis = TEXT_MODEL;
    console.log(`GROQ_PROC(Docs): Processing ${base64Frames.length} frames in chunks of ${VISION_MODEL_IMAGE_LIMIT} for doc generation...`);

    if (!transcript) {
        // Maybe return an error markdown message?
        return { summary: "# Error\n\nTranscript is required to generate documentation.", modelUsed: 'N/A' };
    }

    const partialAnalyses = [];
    const numFrames = base64Frames.length;

    // --- Handle case with no frames ---
    if (numFrames === 0) {
        console.log("GROQ_PROC(Docs): No frames provided. Attempting doc generation from transcript only.");
        // Adapt the synthesis prompt for transcript-only case
        return await generateDocFromTextOnly(transcript, modelForFinalSynthesis);
    }

    // --- Calculate Chunks ---
    const numChunks = Math.ceil(numFrames / VISION_MODEL_IMAGE_LIMIT);
    console.log(`GROQ_PROC(Docs): Will process in ${numChunks} chunk(s).`);

    // --- Sequentially Analyze Each Chunk ---
    for (let i = 0; i < numChunks; i++) {
        const chunkIndex = i + 1;
        const start = i * VISION_MODEL_IMAGE_LIMIT;
        const end = start + VISION_MODEL_IMAGE_LIMIT;
        const currentChunkFrames = base64Frames.slice(start, end);
        const frameNumbers = `Frames ${start + 1}-${Math.min(end, numFrames)}`;

        if (currentChunkFrames.length === 0) continue;

        console.log(`GROQ_PROC(Docs): Analyzing Chunk ${chunkIndex}/${numChunks} (${frameNumbers}, ${currentChunkFrames.length} frames) using ${VISION_MODEL}...`);

        // Prepare payload for the Vision model - FOCUS ON EXTRACTION
        const userMessages = [
            {
                type: "text",
                text: `This is part ${chunkIndex} of ${numChunks} analyzing visual frames from a coding demo video. Use the full transcript ONLY for context. Your task is to EXTRACT specific technical details visible in the following ${currentChunkFrames.length} frame(s) (${frameNumbers}). List any:
1. Complete commands in terminals.
2. Readable code snippets (as accurately as possible).
3. Filenames shown.
4. Specific UI elements clicked/configured.
5. Configuration values displayed.
Present ONLY the extracted details for this segment, do not add conversational text or summaries.

Full Transcript (for context only):
'''
${transcript}
'''`
            }
        ];

        currentChunkFrames.forEach((base64Data) => {
             if (typeof base64Data === 'string' && base64Data.startsWith('data:image/jpeg;base64,')) {
                userMessages.push({ type: "image_url", image_url: { url: base64Data } });
             } else { console.warn(`GROQ_PROC(Docs): Skipping invalid frame data in chunk ${chunkIndex}.`); }
        });

        const visionPayload = {
            model: VISION_MODEL,
            messages: [
                { role: "system", content: `You are an AI assistant extracting technical details (code, commands, filenames, UI elements, config values) visible in video frames (${frameNumbers}), using the transcript for context.` },
                { role: "user", content: userMessages }
            ],
            max_tokens: 1024 // Allow more tokens for potentially verbose extractions
        };

        // Call Groq Vision API for the current chunk
        try {
            // Add slight delay maybe? Optional.
            // if(i > 0) await new Promise(resolve => setTimeout(resolve, 300));
            const completion = await groq.chat.completions.create(visionPayload);
            const analysisText = completion.choices[0]?.message?.content?.trim();
            if (analysisText) {
                partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: analysisText });
                console.log(`GROQ_PROC(Docs): Extraction received for Chunk ${chunkIndex}.`);
            } else {
                console.warn(`GROQ_PROC(Docs): Received empty extraction for Chunk ${chunkIndex}. Storing placeholder.`);
                partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: "[No specific details extracted for this segment]" });
            }
        } catch (error) {
            console.error(`GROQ_PROC(Docs): Error extracting details from Chunk ${chunkIndex} (${frameNumbers}) using ${VISION_MODEL}:`, error.message);
            partialAnalyses.push({ chunk: chunkIndex, frameRange: frameNumbers, analysis: `[Error during detail extraction: ${error.message}]` });
        }
    } // --- End of chunk processing loop ---

    // --- Check if any analyses were generated ---
    const successfulAnalyses = partialAnalyses.filter(pa => !pa.analysis.startsWith("[Error") && !pa.analysis.startsWith("[No specific details"));

    if (successfulAnalyses.length === 0) {
         console.warn("GROQ_PROC(Docs): No details extracted from visual frames. Attempting doc generation from transcript only.");
         return await generateDocFromTextOnly(transcript, modelForFinalSynthesis);
    }

    // --- Final Synthesis Step (Generate Markdown) ---
    console.log(`GROQ_PROC(Docs): Synthesizing ${successfulAnalyses.length} visual detail sets with transcript into Markdown using ${modelForFinalSynthesis}...`);

    // Combine analyses into a single string for the prompt
    let combinedVisualDetails = "";
    successfulAnalyses.forEach(pa => {
        combinedVisualDetails += `\nDetails Extracted from ${pa.frameRange}:\n${pa.analysis}\n---`;
    });

    // The Technical Writer Prompt
    const synthesisPrompt = `
    You are an AI technical writer tasked with creating **professional, developer-grade documentation** based on a video transcript and extracted visual details (such as code, commands, filenames, API references, and UI interactions). 
    
    You must generate a **clear, detailed, and comprehensive Markdown document**, closely matching the quality and depth found in official SDK documentation like the Android SDK or React SDK guides.
    
    **Guidelines:**
    
    - **Start immediately with Markdown content.** No preambles, no explanations.
    - **Use clean, structured Markdown formatting**:
      - Headings (\`#\`, \`##\`, \`###\`, etc.) to organize content hierarchically.
      - Bullet points (\`-\` or \`*\`) for lists.
      - Numbered steps for sequential instructions.
      - Inline code formatting (\` \`) for filenames, commands, paths, and code references.
      - Syntax-highlighted code blocks (\`\`\`language\n...\n\`\`\`) for code snippets, commands, and examples.
    - **Standard Document Sections** (if applicable):
      - # Introduction
      - # Prerequisites
      - # Installation
      - # Configuration
      - # Usage
      - # Examples
      - # Best Practices
      - # Troubleshooting
      - # Additional Resources
    - **Prioritize extracted visual details** for accuracy.
    - **Summarize and clarify complex concepts** if the transcript is ambiguous.
    - **Infer missing logical connections if necessary, but clearly mark them as notes or assumptions** when appropriate.
    - **Match the tone of professional SDKs**:
      - Concise but complete.
      - Neutral, precise, and instructional language.
      - Use active voice and direct instructions ("Run this command...", "Edit the file...").
    - **Error Handling**:
      - Include common errors, warnings, or tips based on information provided.
    - **Code Quality**:
      - Ensure code snippets are clean, properly indented, and complete where possible.
    
    ---
    
    **Source Information:**
    
    **Full Audio Transcript:**
    '''
    ${transcript}
    '''
    
    **Extracted Visual Details from Frame Segments:**
    '''
    ${combinedVisualDetails}
    '''
    
    ---
    **Generate the complete, professional Markdown documentation below:**
    `;
     // Removed the example structure to let the AI generate it fully

    const synthesisPayload = {
        model: modelForFinalSynthesis,
        messages: [
            { role: "system", content: "You are an AI technical writer tasked with creating **professional, developer-grade documentation** based on a video transcript and extracted visual details (such as code, commands, filenames, API references, and UI interactions)." },
            { role: "user", content: synthesisPrompt }
        ],
        // Increase max_tokens significantly for potentially long documentation
        max_tokens: 3500 // Adjust based on expected doc length and model limits
    };

    // Call Groq Text API for final Markdown generation
    try {
        const finalCompletion = await groq.chat.completions.create(synthesisPayload);
        const finalMarkdown = finalCompletion.choices[0]?.message?.content?.trim();
        if (!finalMarkdown) {
            throw new Error("Final Markdown generation resulted in an empty response.");
        }
        console.log("GROQ_PROC(Docs): Final Markdown generation successful.");
        // Return Markdown and the model used for this final step
        return { summary: finalMarkdown, modelUsed: modelForFinalSynthesis };
    } catch (error) {
         console.error(`GROQ_PROC(Docs): Error during final Markdown generation (${modelForFinalSynthesis}):`, error);
         throw new Error(`Final Markdown documentation generation failed: ${error.message}`);
    }
}

// Helper function for transcript-only documentation generation (fallback)
async function generateDocFromTextOnly(transcript, model) {
     console.log(`GROQ_PROC(Docs-TextOnly): Generating docs from transcript only using ${model}...`);
     const prompt = `You are an AI technical writer. Generate Markdown documentation for a product based ONLY on the following audio transcript from a demonstration video. Structure it logically (Introduction, Setup, Usage, etc.) using Markdown headings, lists, and code blocks where appropriate. Extract commands and steps mentioned.\n\nTranscript:\n'''\n${transcript}\n'''\n\nGenerate the complete Markdown documentation file below:`;
     const payload = {
         model: model,
         messages: [
             { role: "system", content: "You are an AI technical writer creating Markdown documentation from an audio transcript." },
             { role: "user", content: prompt }
         ],
         max_tokens: 3000
     };
      try {
        const completion = await groq.chat.completions.create(payload);
        const markdown = completion.choices[0]?.message?.content?.trim();
        if (!markdown) throw new Error("Text-only doc generation was empty.");
        return { summary: markdown, modelUsed: model };
    } catch (error) {
         console.error(`GROQ_PROC(Docs-TextOnly): Error during text-only doc generation (${model}):`, error);
         // Return an error message in Markdown format
         return { summary: `# Error\n\nFailed to generate documentation from transcript: ${error.message}`, modelUsed: model };
    }
}


/**
 * Summarizes text content using Groq text model. (Used for audio-only original purpose)
 * Kept separate in case you want different prompts/logic for pure summarization vs doc generation.
 * @param {string} transcript The audio transcript.
 * @returns {Promise<{summary: string, modelUsed: string}>}
 */
export async function summarizeAudioContent(transcript) {
    const modelUsed = TEXT_MODEL;
    console.log(`GROQ_PROC(AudioSumm): Preparing text summary request for Groq model: ${modelUsed}`);

     if (!transcript || transcript.trim().length === 0) {
         return { summary: "[No transcript provided or transcript was empty]", modelUsed: modelUsed };
    }

    const payload = {
        model: modelUsed,
        messages: [ { role: "system", content: "You are an expert at summarizing audio transcripts concisely." }, { role: "user", content: `Please provide a concise summary of the following transcript:\n\n${transcript}` } ],
        max_tokens: 512
    };
    console.log(`GROQ_PROC(AudioSumm): Sending request to Groq (${modelUsed})...`);
    try {
        const completion = await groq.chat.completions.create(payload); const summary = completion.choices[0]?.message?.content?.trim();
        if (!summary) { return { summary: "[Summary generation failed or returned empty]", modelUsed: modelUsed }; }
        console.log("GROQ_PROC(AudioSumm): Groq Text summary processing successful.");
        return { summary: summary, modelUsed: modelUsed };
    } catch (error) { console.error(`GROQ_PROC(AudioSumm): Groq API Error (${modelUsed}):`, error); throw new Error(`Groq API request failed (${modelUsed}) for text summary: ${error.message}`); }
}