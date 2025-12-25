import React, { useState, useEffect, useRef } from 'react';
import { Upload, Scissors, Play, Download, Music, ShieldAlert, Zap, Film, Cpu, CheckCircle } from 'lucide-react';
import { KillEvent, ProcessingState, VibeType } from './types';
import { analyzeGameplay } from './services/geminiService';
import { processVideo } from './services/ffmpegService';

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ status: 'idle', message: '', progress: 0 });
  const [analysis, setAnalysis] = useState<KillEvent[]>([]);
  const [selectedVibe, setSelectedVibe] = useState<VibeType>('Bollywood Phonk');
  const [isPaid, setIsPaid] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [rankUpStep, setRankUpStep] = useState(0); // 0: Idle, 1: Scanning, 2: Syncing, 3: Finalizing
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setProcessing({ status: 'idle', message: 'Ready to analyze', progress: 0 });
      setAnalysis([]);
      setVideoUrl(null);
      setRankUpStep(0);
    }
  };

  const startAnalysis = async () => {
    if (!videoFile) return;
    try {
      setRankUpStep(1);
      setProcessing({ status: 'analyzing', message: 'Scanning for Headshots...', progress: 10 });
      const events = await analyzeGameplay(videoFile, (msg) => {
        setProcessing(prev => ({ ...prev, message: msg }));
      });
      setAnalysis(events);
      setProcessing({ status: 'idle', message: `Found ${events.length} high-impact moments.`, progress: 100 });
      setRankUpStep(2); // Ready for next step
    } catch (error) {
      setProcessing({ status: 'error', message: 'Analysis failed.', progress: 0 });
      setRankUpStep(0);
    }
  };

  const startProcessing = async () => {
    if (!videoFile || analysis.length === 0) return;
    try {
      setRankUpStep(2); // Syncing
      setProcessing({ status: 'cutting', message: 'Cine-Sync Engine: Initializing...', progress: 0 });
      const url = await processVideo(videoFile, analysis, selectedVibe, isPaid, (prog, msg) => {
        setProcessing({ status: 'cutting', message: msg, progress: prog });
        if (prog > 60) setRankUpStep(3); // Finalizing
      });
      setVideoUrl(url);
      setProcessing({ status: 'completed', message: 'Match Found', progress: 100 });
    } catch (error) {
      console.error(error);
      setProcessing({ status: 'error', message: 'Render failed.', progress: 0 });
    }
  };

  const handlePayment = () => {
    setTimeout(() => {
      setIsPaid(true);
      setShowPayment(false);
    }, 2000);
  };

  // Rank Up Bar Component
  const RankUpBar = () => (
    <div className="w-full bg-black/50 border-t border-b border-valorant-charcoal/50 p-6 backdrop-blur-sm mb-8">
      <div className="flex justify-between items-center max-w-4xl mx-auto relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10 transform -translate-y-1/2"></div>
        <div 
          className="absolute top-1/2 left-0 h-1 bg-valorant-red -z-10 transform -translate-y-1/2 transition-all duration-700"
          style={{ width: `${(Math.max(0, rankUpStep - 1) / 2) * 100}%` }}
        ></div>

        {['Scanning', 'Syncing', 'Finalizing'].map((step, idx) => {
           const isActive = rankUpStep > idx;
           const isCurrent = rankUpStep === idx + 1;
           return (
             <div key={step} className="flex flex-col items-center gap-2">
                <div className={`w-4 h-4 rotate-45 border-2 transition-all duration-300 ${isActive || isCurrent ? 'bg-valorant-red border-valorant-red' : 'bg-valorant-charcoal border-gray-600'}`}></div>
                <span className={`font-display uppercase tracking-widest text-sm ${isActive || isCurrent ? 'text-white' : 'text-gray-600'}`}>
                  {step}
                </span>
             </div>
           );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-valorant-charcoal text-valorant-white font-sans bg-grid-pattern bg-[length:40px_40px]">
      
      {/* Header */}
      <header className="border-b border-white/10 bg-valorant-charcoal/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-valorant-red p-2 rounded-sm transform -skew-x-12">
               <Scissors className="text-white w-6 h-6 transform skew-x-12" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight uppercase text-white">
              val<span className="text-valorant-red">-Cut</span> AI
            </h1>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-sm">
                <Cpu className="w-4 h-4 text-valorant-blue" />
                <span className="font-mono text-xs text-valorant-blue tracking-wider">GEMINI 3 FLASH ACTIVE</span>
             </div>
          </div>
        </div>
      </header>

      {/* Rank Up Progress */}
      {videoFile && <RankUpBar />}

      <main className="max-w-6xl mx-auto px-6 pb-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: CONFIGURATION */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upload Zone */}
            <div className="bg-white/5 border border-valorant-blue/30 p-1 rounded-sm">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative h-64 border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center group overflow-hidden
                  ${videoFile ? 'border-valorant-red bg-valorant-red/10' : 'border-valorant-blue/50 hover:border-valorant-blue hover:bg-valorant-blue/5'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="video/*" 
                  onChange={handleFileChange} 
                />
                
                {/* Decoration Lines */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-current opacity-50"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-current opacity-50"></div>

                {videoFile ? (
                  <div className="z-10">
                    <Film className="w-12 h-12 mx-auto text-valorant-red mb-4 animate-pulse" />
                    <p className="font-display text-xl uppercase tracking-wider">{videoFile.name}</p>
                    <p className="font-mono text-xs text-gray-400 mt-2">{(videoFile.size / (1024*1024)).toFixed(1)} MB LOADED</p>
                  </div>
                ) : (
                  <div className="z-10">
                    <Upload className="w-12 h-12 mx-auto text-valorant-blue mb-4 group-hover:scale-110 transition-transform" />
                    <p className="font-display text-xl uppercase tracking-wider text-white group-hover:text-valorant-blue transition-colors">Initiate Upload</p>
                    <p className="font-mono text-xs text-gray-400 mt-2">DRAG & DROP RAW FOOTAGE</p>
                  </div>
                )}
              </div>
            </div>

            {/* BGM Selector */}
            {videoFile && (
              <div className="space-y-2 animate-fade-in">
                <label className="font-display text-lg uppercase tracking-wider text-gray-400">Audio Protocol</label>
                <div className="relative">
                  <select 
                    value={selectedVibe}
                    onChange={(e) => setSelectedVibe(e.target.value as VibeType)}
                    className="w-full bg-valorant-charcoal border border-white/20 text-white font-mono p-4 appearance-none focus:border-valorant-red focus:outline-none transition-colors"
                  >
                    <option value="Bollywood Phonk">BOLLYWOOD PHONK</option>
                    <option value="South Indian Mass BGM">SOUTH INDIAN MASS BGM</option>
                    <option value="Global Phonk">GLOBAL PHONK</option>
                    <option value="None">NONE (RAW AUDIO)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {videoFile && !analysis.length && (
              <button 
                onClick={startAnalysis}
                className="w-full py-5 bg-valorant-red hover:bg-red-600 text-white font-display font-bold text-xl uppercase tracking-widest clip-button transition-all transform hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(255,70,85,0.4)]"
              >
                Start Scan
              </button>
            )}

            {analysis.length > 0 && !videoUrl && (
              <button 
                onClick={startProcessing}
                disabled={processing.status === 'cutting'}
                className="w-full py-5 bg-valorant-blue text-black hover:bg-cyan-300 font-display font-bold text-xl uppercase tracking-widest clip-button transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing.status === 'cutting' ? 'Processing...' : 'Auto-Edit Montage'}
              </button>
            )}
          </div>

          {/* RIGHT PANEL: VISUALIZATION */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Console / Status */}
            <div className="bg-black/40 border border-white/10 min-h-[200px] p-6 font-mono text-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-20">
                 <Cpu className="w-24 h-24" />
               </div>
               
               <div className="relative z-10 space-y-2">
                 <div className="flex items-center gap-2 text-gray-500 mb-4 border-b border-gray-800 pb-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span>SYSTEM LOG</span>
                 </div>
                 
                 {processing.message && (
                   <div className="text-valorant-blue">
                     <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                     {processing.message}
                   </div>
                 )}
                 
                 {analysis.length > 0 && (
                   <div className="mt-4 grid grid-cols-2 gap-4">
                      {analysis.map((event, i) => (
                        <div key={i} className="bg-white/5 border-l-2 border-valorant-red p-2 flex justify-between items-center">
                          <div>
                            <span className="text-valorant-red font-bold">{event.timestamp}</span>
                            <span className="text-gray-400 text-xs ml-2 uppercase">{event.event}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {event.intensity >= 9 && <Zap className="w-3 h-3 text-yellow-400" />}
                            <span className="text-xs">{event.weapon}</span>
                          </div>
                        </div>
                      ))}
                   </div>
                 )}
               </div>
            </div>

            {/* Preview Window */}
            {videoUrl && (
              <div className="animate-fade-in space-y-6">
                <div className="relative border border-valorant-red bg-black aspect-video group">
                  <video src={videoUrl} controls className="w-full h-full object-contain" />
                  
                  {/* Heavy Watermark Overlay */}
                  {!isPaid && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-black/10 z-20 overflow-hidden">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-8 p-8 opacity-20 rotate-12 scale-125">
                         {Array.from({length: 9}).map((_, i) => (
                           <div key={i} className="flex items-center justify-center border-4 border-white">
                             <span className="font-display font-black text-4xl text-white uppercase">PREVIEW</span>
                           </div>
                         ))}
                      </div>
                      <div className="bg-black/80 px-8 py-4 border-y-2 border-valorant-red z-30 transform -rotate-2">
                        <span className="text-3xl font-display font-black text-white tracking-widest uppercase">TRIAL VERSION</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  {!isPaid ? (
                    <button 
                      onClick={() => setShowPayment(true)}
                      className="w-full py-6 bg-gradient-to-r from-red-600 to-valorant-red text-white font-display font-bold text-2xl uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></span>
                      <Zap className="w-6 h-6 fill-current" />
                      Unlock 4K No-Watermark Export (₹10)
                    </button>
                  ) : (
                    <a 
                      href={videoUrl} 
                      download="ValCut_Pro_Montage.mp4"
                      className="w-full py-6 bg-valorant-blue text-black font-display font-bold text-2xl uppercase tracking-widest hover:bg-cyan-300 transition-colors flex items-center justify-center gap-3"
                    >
                      <Download className="w-6 h-6" />
                      Download 4K Montage
                    </a>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-valorant-charcoal border border-white/20 max-w-md w-full p-8 relative overflow-hidden shadow-[0_0_50px_rgba(0,238,238,0.1)]">
            <button 
              onClick={() => setShowPayment(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
            
            <div className="text-center relative z-10">
              <div className="inline-block bg-valorant-red p-3 rounded-full mb-4">
                 <Zap className="w-8 h-8 text-white fill-current" />
              </div>
              <h3 className="text-3xl font-display font-bold uppercase text-white mb-2">Unlock Full Potential</h3>
              <p className="text-gray-400 font-mono text-sm mb-8">REMOVE WATERMARK • 4K EXPORT • HIGH BITRATE</p>
              
              <div className="bg-white p-4 rounded-sm inline-block mb-6 relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-valorant-red to-valorant-blue opacity-50 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white p-1">
                    <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=yourvpa@okicici&pn=CineCutAI&am=10.00&cu=INR`} 
                    alt="UPI QR Code" 
                    className="w-48 h-48 mix-blend-multiply"
                    />
                </div>
              </div>
              
              <div className="bg-black/50 p-3 rounded border border-white/10 mb-6">
                <p className="text-xs text-gray-500 font-mono mb-1">UPI ID</p>
                <p className="text-valorant-blue font-mono select-all">yourvpa@okicici</p>
              </div>

              <button 
                onClick={handlePayment}
                className="w-full py-4 bg-white text-black font-display font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors clip-diagonal"
              >
                I have completed payment
              </button>
            </div>
            
            {/* Background Deco */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-valorant-red via-transparent to-valorant-blue"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-valorant-blue/5 rounded-full blur-3xl"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;