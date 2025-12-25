import { GoogleGenAI, Type } from "@google/genai";
import { KillEvent } from "../types";

// Note: In a production environment, never expose keys on the client.
// This is for demonstration purposes as per the prompt instructions using process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are an expert Valorant Video Analyst and Cinematic Editor. Your task is to analyze raw gameplay footage and identify "High-Impact Moments."

1. STAMPS: Identify every timestamp (in MM:SS) where a kill occurs. Focus on Headshots (yellow skull icon) and Multi-kills (Ace/Quadra).
2. INTENSITY: Assign an 'Intensity Score' from 1-10 to each kill based on the weapon (higher for Operator/Sheriff) and the speed of the kill.
3. JSON OUTPUT: Always output your analysis in a clean JSON format. Do not include prose.

Example Output Format: [ {"timestamp": "01:24", "event": "Headshot", "weapon": "Vandal", "intensity": 8, "duration": 5}, {"timestamp": "04:10", "event": "Ace", "weapon": "Operator", "intensity": 10, "duration": 15} ]
`;

/**
 * Extracts frames from a video file at a low FPS to send to Gemini.
 * Since we can't upload large video files directly from client without backend signing,
 * we extract frames as a robust workaround.
 */
async function extractFrames(videoFile: File, intervalSeconds: number = 2): Promise<string[]> {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  const url = URL.createObjectURL(videoFile);
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  // Wait for metadata to load to get duration
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(true);
  });

  const frames: string[] = [];
  const duration = video.duration;
  
  // Resize to a manageable size for LLM vision (e.g., 640px width)
  // This reduces payload size significantly while maintaining visibility of UI elements like killfeed.
  const scale = 480 / video.videoHeight;
  canvas.width = video.videoWidth * scale;
  canvas.height = 480; 

  for (let time = 0; time < duration; time += intervalSeconds) {
    video.currentTime = time;
    await new Promise(r => video.onseeked = r);
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Use medium quality JPEG
    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    frames.push(base64);
  }

  URL.revokeObjectURL(url);
  return frames;
}

export async function analyzeGameplay(videoFile: File, onProgress: (msg: string) => void): Promise<KillEvent[]> {
  try {
    onProgress("Extracting frames for AI vision...");
    // Sample every 2 seconds. For a 5 min video, that's 150 frames.
    const frames = await extractFrames(videoFile, 2);
    
    onProgress(`Analyzing ${frames.length} frames with Gemini 3 Flash...`);

    const parts = frames.map(f => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: f
      }
    }));

    // Add the text prompt at the end
    const promptPart = {
      text: `Analyze this sequence of frames extracted at 2-second intervals. Frame 1 = 0s, Frame 2 = 2s, etc. Return the JSON analysis of kills.`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [...parts, promptPart]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.STRING },
              event: { type: Type.STRING },
              weapon: { type: Type.STRING },
              intensity: { type: Type.NUMBER },
              duration: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const events = JSON.parse(text) as KillEvent[];
    return events;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
