import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
    console.error("FATAL ERROR: GROQ_API_KEY is not set. Cannot initialize Groq client in audioProcessor.");
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const STT_MODEL = "whisper-large-v3";

export async function transcribeAudio(audioPath) {
    console.log(`Transcribing ${audioPath} using Groq STT model: ${STT_MODEL}...`);

    try {
        const transcription = await groq.audio.transcriptions.create({
            model: STT_MODEL,
            file: fs.createReadStream(audioPath),
        });

        console.log("Groq STT transcription successful.");

        if (typeof transcription.text !== 'string') {
            console.error("Unexpected response format from Groq STT:", transcription);
            throw new Error("Groq STT API returned an unexpected response format.");
        }

        return transcription.text;

    } catch (error) {
        console.error(`Error calling Groq STT API (${STT_MODEL}):`, error);
        throw new Error(`Failed to transcribe audio via Groq STT: ${error.message || 'Unknown Groq STT Error'}`);
    }
}
