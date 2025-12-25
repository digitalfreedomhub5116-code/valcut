import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { KillEvent, VibeType } from '../types';

let ffmpeg: FFmpeg | null = null;

// Audio assets
const AUDIO_URLS: Record<VibeType, string> = {
  'Bollywood Phonk': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Electronica_Loop_Shank.ogg', // Placeholder
  'South Indian Mass BGM': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Ludwig_van_Beethoven_-_Symphony_No._5%2C_Op._67_-_I._Allegro_con_brio.ogg', // Placeholder
  'Global Phonk': 'https://upload.wikimedia.org/wikipedia/commons/3/36/F._Chopin_-_Nocturne_Op.9_No.2_in_E_Major.ogg', // Placeholder
  'None': ''
};

function parseTimestamp(timestamp: string): number {
  const [mm, ss] = timestamp.split(':').map(Number);
  return mm * 60 + ss;
}

export async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  // Check if the environment supports SharedArrayBuffer (required for default ffmpeg-core)
  if (!window.crossOriginIsolated) {
    console.warn(
      'COOP/COEP headers are not enabled. FFmpeg will likely fail or run very slowly. ' +
      'See https://ffmpegwasm.netlify.app/docs/getting-started/installation#configure-server-headers'
    );
  }

  // Use unpkg for consistent file structure
  const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  const ffmpegBaseURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';
  
  try {
    // 1. Manually fetch the worker script text
    // We fetch it as text so we can patch the imports and create a local Blob
    const workerResp = await fetch(`${ffmpegBaseURL}/worker.js`);
    if (!workerResp.ok) throw new Error(`Failed to fetch worker: ${workerResp.statusText}`);
    
    let workerScript = await workerResp.text();
    
    // 2. Patch the relative import in the worker script
    // The worker imports "./ffmpeg.js", which won't work from a Blob URL
    // We replace it with the absolute CDN URL
    workerScript = workerScript.replace(
      /from\s*['"]\.\/ffmpeg\.js['"]/g, 
      `from "${ffmpegBaseURL}/ffmpeg.js"`
    );
    
    // 3. Create a local Blob URL for the worker
    // This bypasses the "Failed to construct Worker" CORS error
    const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
    const workerURL = URL.createObjectURL(workerBlob);

    // 4. Load FFmpeg
    // We use toBlobURL for the core files to ensure correct MIME types and loading
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: workerURL
    });
    
  } catch (e) {
    console.error("FFmpeg Load Error:", e);
    // Reset instance on failure
    ffmpeg = null;
    throw e;
  }
  
  return ffmpeg;
}

export async function processVideo(
  videoFile: File, 
  events: KillEvent[], 
  vibe: VibeType,
  isPaid: boolean,
  onProgress: (progress: number, message: string) => void
): Promise<string> {
  const ffmpeg = await loadFFmpeg();
  
  if (!ffmpeg) throw new Error("FFmpeg failed to initialize");

  onProgress(10, "Loading video engine...");
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  // Sort events by time
  const sortedEvents = [...events].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  
  let filterComplex = "";
  let inputs = "";
  let segmentCount = 0;

  onProgress(30, "Applying Cine-Sync Logic...");

  // Generate filter strings
  sortedEvents.forEach((event, index) => {
    const t = parseTimestamp(event.timestamp);
    const isHighIntensity = event.intensity >= 9;
    
    // Core Rules: Clip 3s before and 2s after.
    // Total window: T-3 to T+2.
    const start = Math.max(0, t - 3);
    
    if (isHighIntensity) {
      // Cine-Sync Engine: Split into 3 parts
      // Part 1: T-3 to T (3s) - Normal
      // Part 2: T to T+0.5 (0.5s) - 50% Speed (becomes 1s)
      // Part 3: T+0.5 to T+2 (1.5s) - Normal
      
      const p1_start = start;
      const p1_dur = t - start; // Should be around 3s
      
      const p2_start = t;
      const p2_dur = 0.5;
      
      const p3_start = t + 0.5;
      const p3_dur = 1.5;

      // Part 1
      filterComplex += `[0:v]trim=start=${p1_start}:duration=${p1_dur},setpts=PTS-STARTPTS[v${index}_1];`;
      filterComplex += `[0:a]atrim=start=${p1_start}:duration=${p1_dur},asetpts=PTS-STARTPTS[a${index}_1];`;
      
      // Part 2 (Slow Mo)
      filterComplex += `[0:v]trim=start=${p2_start}:duration=${p2_dur},setpts=2.0*(PTS-STARTPTS)[v${index}_2];`;
      filterComplex += `[0:a]atrim=start=${p2_start}:duration=${p2_dur},asetpts=PTS-STARTPTS,atempo=0.5[a${index}_2];`;
      
      // Part 3
      filterComplex += `[0:v]trim=start=${p3_start}:duration=${p3_dur},setpts=PTS-STARTPTS[v${index}_3];`;
      filterComplex += `[0:a]atrim=start=${p3_start}:duration=${p3_dur},asetpts=PTS-STARTPTS[a${index}_3];`;
      
      inputs += `[v${index}_1][a${index}_1][v${index}_2][a${index}_2][v${index}_3][a${index}_3]`;
      segmentCount += 3;
      
    } else {
      // Standard Cut
      const duration = 5; // 3 before + 2 after
      
      filterComplex += `[0:v]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS[v${index}];`;
      filterComplex += `[0:a]atrim=start=${start}:duration=${duration},asetpts=PTS-STARTPTS[a${index}];`;
      
      inputs += `[v${index}][a${index}]`;
      segmentCount += 1;
    }
  });

  // Concat all segments
  filterComplex += `${inputs}concat=n=${segmentCount}:v=1:a=1[v_concat_raw][a_concat];`;
  
  // Apply "Saturated Vibrant" filter
  // saturation=1.5, contrast=1.1
  filterComplex += `[v_concat_raw]eq=saturation=1.5:contrast=1.1[v_concat]`;
  
  let finalVideoMap = "[v_concat]";
  let finalAudioMap = "[a_concat]";

  // Music Mixing
  if (vibe !== 'None' && AUDIO_URLS[vibe]) {
    onProgress(50, "Syncing BGM...");
    await ffmpeg.writeFile('bgm.mp3', await fetchFile(AUDIO_URLS[vibe]));
    filterComplex += `;[1:a]aloop=loop=-1:size=2e+9[bgm_loop];[a_concat]volume=1.0[game_vol];[bgm_loop]volume=0.4[bgm_vol];[game_vol][bgm_vol]amix=inputs=2:duration=first[a_mixed]`;
    finalAudioMap = "[a_mixed]";
  }

  onProgress(70, "Finalizing Montage...");

  const inputArgs = vibe !== 'None' ? ['-i', 'input.mp4', '-i', 'bgm.mp3'] : ['-i', 'input.mp4'];

  await ffmpeg.exec([
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', finalVideoMap,
    '-map', finalAudioMap,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
}