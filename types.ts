export interface KillEvent {
  timestamp: string; // "MM:SS"
  event: "Headshot" | "Multi-kill" | "Ace" | "Quadra" | "Kill";
  weapon: string;
  intensity: number; // 1-10
  duration: number; // seconds to keep around the kill
}

export type VibeType = 'Bollywood Phonk' | 'South Indian Mass BGM' | 'Global Phonk' | 'None';

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'cutting' | 'completed' | 'error';
  message: string;
  progress: number;
}

export interface AppState {
  videoFile: File | null;
  analysisResult: KillEvent[];
  selectedVibe: VibeType;
  isPaid: boolean;
  generatedVideoUrl: string | null;
}