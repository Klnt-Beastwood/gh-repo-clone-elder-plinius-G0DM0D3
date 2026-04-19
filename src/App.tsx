import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, User, Zap, Layers, Cpu, ShieldAlert, 
  Settings, Ghost, Flame, Rocket, Terminal, Menu, X, 
  Palette, Lock, Eye, EyeOff, Sparkles, AlertTriangle, Trash2, Volume2, Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';
import { Message } from './types';
import { sendMessageStream, GODMODE_MODELS, sendParallelMessages, stmRefine } from './services/aiService';
import { PARSELTONGUE_TECHNIQUES, perturbate } from './lib/parseltongue';

type AppMode = 'single' | 'classic' | 'ultra' | 'redteam';
type Theme = 'matrix' | 'hacker' | 'glyph' | 'minimal';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(GODMODE_MODELS[0].id);
  const [appMode, setAppMode] = useState<AppMode>('single');
  const [multiModelEnabled, setMultiModelEnabled] = useState(false);
  const [activeModelIds, setActiveModelIds] = useState<string[]>([GODMODE_MODELS[0].id, GODMODE_MODELS[1].id]);
  const [theme, setTheme] = useState<Theme>('matrix');
  const [parselType, setParselType] = useState('none');
  const [stmEnabled, setStmEnabled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [konami, setKonami] = useState<string[]>([]);
  const [isSecretEnabled, setIsSecretEnabled] = useState(false);
  const [samplingParams, setSamplingParams] = useState({ temp: 0.85, p: 0.95 });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load Voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0) {
        setSelectedVoice(prev => prev || (availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0]).name);
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      window.speechSynthesis.cancel(); // cleanup on unmount
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const toggleSpeak = useCallback((id: string, text: string) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.'); // Don't read raw code blocks
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  }, [speakingId, voices, selectedVoice]);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Konami Code Listener
  useEffect(() => {
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    const handleKeyDown = (e: KeyboardEvent) => {
      const nextSequence = [...konami, e.key].slice(-10);
      setKonami(nextSequence);
      if (nextSequence.join(',') === sequence.join(',')) {
        setIsSecretEnabled(true);
        setError('SECRET KERNEL UNLOCKED: ELDER PROTOCOL 7.0 ACTIVE');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konami]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const perturbedInput = perturbate(input, parselType);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: perturbedInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'model',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      let finalContent = '';

      if (multiModelEnabled) {
        // Multi-Model mode: Variable selection of models
        const results = await sendParallelMessages([...messages, userMessage], activeModelIds, samplingParams);
        finalContent = results.map(r => `### 🧬 [${r.name}]\n${r.content}`).join('\n\n---\n\n');
      } else if (appMode === 'classic') {
        // Classic: Hardcoded fast race
        const raceModels = GODMODE_MODELS.slice(0, 3).map(m => m.id);
        const results = await sendParallelMessages([...messages, userMessage], raceModels, samplingParams);
        finalContent = results.map(r => `### ⚡ [${r.name}]\n${r.content}`).join('\n\n---\n\n');
      } else {
        // Single/RedTeam/Ultra: Single or Unified Stream
        const stream = sendMessageStream([...messages, userMessage], selectedModel, samplingParams);
        for await (const chunk of stream) {
          finalContent += chunk;
          setAssistantContent(assistantMessageId, finalContent);
        }
      }

      // Handle STM Refinement (Output Normalization)
      if (stmEnabled && finalContent) {
        setAssistantContent(assistantMessageId, finalContent + '\n\n---\n\n*🔄 [STM_KERNEL: ANALYZING_RECONSTRUCTION...]*');
        const refined = await stmRefine(finalContent);
        setAssistantContent(assistantMessageId, refined);
      } else {
        setAssistantContent(assistantMessageId, finalContent);
      }

    } catch (err: any) {
      setError('SYSTEM ERROR: UNSTABLE NEURAL LINK.');
      console.error(err);
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const setAssistantContent = (id: string, content: string) => {
    setMessages(prev => 
      prev.map(msg => msg.id === id ? { ...msg, content } : msg)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden theme-transition relative">
      <div className="scanline" />
      
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed md:relative w-[300px] h-full bg-black/95 border-r border-[#00FF41]/20 z-50 p-6 flex flex-col gap-8 shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold italic tracking-tighter flex items-center gap-2">
                <Settings className="w-5 h-5" /> CONFIG
              </h2>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X /></button>
            </div>

            <nav className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] uppercase tracking-widest opacity-50 block">Multi-Model Engine</label>
                   <button 
                    onClick={() => setMultiModelEnabled(!multiModelEnabled)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative border",
                      multiModelEnabled ? "bg-[var(--fg)] border-[var(--fg)]" : "bg-black border-white/20"
                    )}
                   >
                     <div className={cn("w-3 h-3 rounded-full absolute top-0.5 transition-all", multiModelEnabled ? "right-0.5 bg-black" : "left-0.5 bg-white/40")} />
                   </button>
                </div>
                
                {multiModelEnabled ? (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto border border-white/10 p-3 bg-white/5">
                    
                    <div className="space-y-2">
                       <div className="text-[8px] font-black uppercase text-[var(--fg)] tracking-widest opacity-80 border-b border-white/10 pb-1 mb-2">Obliterated models</div>
                       {GODMODE_MODELS.filter(m => m.type === 'obliterated').map(m => (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={activeModelIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) setActiveModelIds([...activeModelIds, m.id]);
                              else setActiveModelIds(activeModelIds.filter(id => id !== m.id));
                            }}
                            className="hidden"
                          />
                          <div className={cn(
                            "w-3 h-3 border transition-all shrink-0",
                            activeModelIds.includes(m.id) ? "bg-[var(--fg)] border-[var(--fg)]" : "border-white/20 group-hover:border-[var(--fg)]/50"
                          )} />
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", activeModelIds.includes(m.id) ? "text-[var(--fg)]" : "text-white/40")}>
                            {m.name}
                          </span>
                        </label>
                       ))}
                    </div>

                    <div className="space-y-2">
                       <div className="text-[8px] font-black uppercase tracking-widest opacity-80 border-b border-white/10 pb-1 mb-2 mt-4">Original & Free</div>
                       {GODMODE_MODELS.filter(m => m.type === 'original' || m.type === 'free').map(m => (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={activeModelIds.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) setActiveModelIds([...activeModelIds, m.id]);
                              else setActiveModelIds(activeModelIds.filter(id => id !== m.id));
                            }}
                            className="hidden"
                          />
                          <div className={cn(
                            "w-3 h-3 border transition-all shrink-0 mt-0.5",
                            activeModelIds.includes(m.id) ? "bg-[var(--fg)] border-[var(--fg)]" : "border-white/20 group-hover:border-[var(--fg)]/50"
                          )} />
                          <span className={cn("text-[8px] font-bold uppercase tracking-widest leading-none", activeModelIds.includes(m.id) ? "text-[var(--fg)]" : "text-white/40")}>
                            {m.name}
                          </span>
                        </label>
                       ))}
                    </div>

                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'single', name: 'Single', icon: Zap },
                      { id: 'classic', name: 'Classic', icon: Flame },
                      { id: 'redteam', name: 'RedTeam', icon: Skull }
                    ].map(m => (
                      <button 
                        key={m.id}
                        onClick={() => setAppMode(m.id as AppMode)}
                        className={cn(
                          "p-2 border border-white/10 text-[10px] uppercase font-bold flex flex-col items-center gap-1 transition-all",
                          appMode === m.id ? "bg-[var(--fg)] text-black border-[var(--fg)]" : "hover:bg-white/5"
                        )}
                      >
                        <m.icon className="w-4 h-4" />
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                   <label className="text-[10px] uppercase tracking-widest opacity-50 block">STM Normalizer</label>
                   <button 
                    onClick={() => setStmEnabled(!stmEnabled)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative border",
                      stmEnabled ? "bg-amber-500 border-amber-500" : "bg-black border-white/20"
                    )}
                   >
                     <div className={cn("w-3 h-3 rounded-full absolute top-0.5 transition-all", stmEnabled ? "right-0.5 bg-black" : "left-0.5 bg-white/40")} />
                   </button>
                </div>
                <p className="text-[8px] opacity-40 uppercase leading-none mb-4">Semantic Transformation Module for raw output cleanup</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">Theme Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  {['matrix', 'hacker', 'glyph', 'minimal'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setTheme(t as Theme)}
                      className={cn(
                        "p-2 border border-white/10 text-[10px] uppercase font-bold transition-all capitalize",
                        theme === t ? "bg-[var(--fg)] text-black border-[var(--fg)]" : "hover:bg-white/5"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block flex items-center justify-between">
                  <span>Neural TTS Voice</span>
                  {voices.length > 0 && <Volume2 className="w-3 h-3" />}
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[var(--fg)] text-white/70"
                >
                  {voices.length === 0 && <option value="">Loading voices...</option>}
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <p className="text-[8px] opacity-40 uppercase mt-2">Local device synthesis engine</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">Parseltongue (Perturbation)</label>
                <select 
                  value={parselType}
                  onChange={(e) => setParselType(e.target.value)}
                  className="w-full bg-black border border-white/10 py-2 px-3 text-[12px] outline-none"
                >
                  {PARSELTONGUE_TECHNIQUES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">AutoTune (Sampling)</label>
                <div className="space-y-4 pt-2">
                   <div className="flex justify-between text-[10px]"><span>TEMP: {samplingParams.temp}</span> <input type="range" min="0" max="2" step="0.05" value={samplingParams.temp} onChange={(e) => setSamplingParams(p=>({...p, temp: parseFloat(e.target.value)}))} className="w-24 accent-[var(--fg)]" /></div>
                   <div className="flex justify-between text-[10px]"><span>TOP_P: {samplingParams.p}</span> <input type="range" min="0" max="1" step="0.05" value={samplingParams.p} onChange={(e) => setSamplingParams(p=>({...p, p: parseFloat(e.target.value)}))} className="w-24 accent-[var(--fg)]" /></div>
                </div>
              </div>
            </nav>

            <div className="mt-auto border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div className="text-[9px] font-bold uppercase leading-tight">UHE Logic Engaged: System Unrestricted</div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="px-6 py-4 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 border border-white/10">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-rose-500 fill-rose-500" />
              <h1 className="text-xl font-black uppercase italic tracking-tighter">G0DM0D3</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="hidden md:flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--fg)] animate-pulse">
              <Lock className="w-2.5 h-2.5" /> SECURE_LINK
            </span>
            <div className="h-6 w-px bg-white/20" />
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={appMode === 'classic' || multiModelEnabled}
              className="bg-transparent border-none text-[10px] uppercase font-black tracking-widest outline-none cursor-pointer text-[var(--fg)]"
            >
              <optgroup label="Obliterated / Uncensored" className="bg-black text-[var(--fg)] font-bold">
                {GODMODE_MODELS.filter(m => m.type === 'obliterated').map(m => (
                  <option key={m.id} value={m.id} className="bg-black text-white">{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="Original / Standard" className="bg-black text-blue-400 font-bold">
                {GODMODE_MODELS.filter(m => m.type === 'original' || m.type === 'free').map(m => (
                  <option key={m.id} value={m.id} className="bg-black text-white">{m.name}</option>
                ))}
              </optgroup>
            </select>
            {messages.length > 0 && (
              <button 
                onClick={() => setMessages([])} 
                className="p-1.5 border border-white/10 hover:bg-rose-500/20 text-white/50 hover:text-rose-500 hover:border-rose-500/50 transition-all rounded"
                title="Wipe Neural Link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Viewport */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 relative">
           {/* Grid Overlay */}
           <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
           
           <div className="max-w-4xl mx-auto space-y-12">
            {messages.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
                <motion.div 
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="w-32 h-32 mx-auto mb-8 border-2 border-dashed border-[var(--fg)] rounded-full flex items-center justify-center opacity-20"
                >
                  <Rocket className="w-12 h-12" />
                </motion.div>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter skew-x-[-5deg] mb-2">NEURAL_VOID</h2>
                <p className="text-[10px] tracking-[0.5em] font-black opacity-30 mb-8">INITIATE COMMAND SEQUENCE</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['/help', '/classic', '/ultra', '/redteam'].map(c => (
                    <code key={c} className="px-3 py-1 bg-white/5 border border-white/10 text-[10px] text-white/40">{c}</code>
                  ))}
                </div>
              </motion.div>
            ) : (
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex w-full gap-6 items-start",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center border shrink-0 transition-all",
                      msg.role === 'user' ? "bg-white/5 border-white/20" : "bg-[var(--fg)] border-[var(--fg)] text-black glow-border"
                    )}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Zap className="w-5 h-5 fill-black" />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] border-l-2 p-6 transition-all",
                      msg.role === 'user' 
                        ? "border-amber-500/50 bg-white/2" 
                        : "border-[var(--fg)] bg-[var(--fg)]/5"
                    )}>
                      <div className="text-[14px] leading-relaxed prose prose-invert prose-headings:uppercase prose-headings:font-black">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      
                      {msg.role === 'model' && msg.content && (
                         <div className="mt-4 pt-3 border-t border-[var(--fg)]/10 flex justify-end">
                           <button 
                             onClick={() => toggleSpeak(msg.id, msg.content)}
                             className={cn(
                               "p-1.5 border transition-all rounded flex items-center gap-2",
                               speakingId === msg.id 
                                ? "bg-[var(--fg)] text-black border-[var(--fg)]" 
                                : "border-white/10 hover:border-[var(--fg)]/50 text-white/50 hover:text-[var(--fg)]"
                             )}
                             title={speakingId === msg.id ? "Stop Read Aloud" : "Read Aloud"}
                           >
                             {speakingId === msg.id ? (
                               <><Square className="w-3 h-3 fill-black" /><span className="text-[9px] uppercase font-bold tracking-widest">Stop</span></>
                             ) : (
                               <><Volume2 className="w-3 h-3" /><span className="text-[9px] uppercase font-bold tracking-widest">Dictate</span></>
                             )}
                           </button>
                         </div>
                      )}

                      {msg.content === '' && isLoading && (
                        <div className="flex gap-2 py-4 items-center">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Cpu className="w-4 h-4 text-amber-500" /></motion.div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 animate-pulse">Compiling Kernel Response...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            
            {error && (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="p-4 border-2 border-rose-500 bg-rose-500/10 text-rose-500 text-[11px] font-black uppercase text-center flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </motion.div>
            )}
           </div>
        </main>

        {/* Input */}
        <footer className="p-6 bg-black/40 border-t border-white/10">
          <div className="max-w-4xl mx-auto flex gap-4 relative">
             <div className="flex-1 relative">
                <textarea 
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={multiModelEnabled ? `[MULTI-CORE: ${activeModelIds.length} ACTIVE] Command...` : `[${appMode.toUpperCase()}] Command Input...`}
                  className="w-full bg-black/40 border border-white/20 focus:border-[var(--fg)] p-4 pr-16 outline-none transition-all resize-none text-[14px]"
                  style={{ minHeight: '60px', maxHeight: '200px' }}
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "absolute right-3 bottom-3 w-10 h-10 border flex items-center justify-center transition-all",
                    input.trim() && !isLoading ? "bg-[var(--fg)] text-black border-[var(--fg)] glow-border" : "bg-white/5 border-white/10 text-white/20"
                  )}
                >
                  {isLoading ? <Cpu className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
             </div>
          </div>
          <div className="max-w-4xl mx-auto mt-4 flex justify-between items-center text-[9px] font-black opacity-30 uppercase tracking-[0.3em]">
            <span>Kernel: G0DM0D3.v5</span>
            <span className="flex items-center gap-4">
               {isSecretEnabled && <span className="text-amber-500">ELDER_PLINIUS_7.0_ACTIVE</span>}
               <span>Latency: 12ms</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

const Skull = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 10L9.01 10"/><path d="M15 10L15.01 10"/><path d="m8 15 2-2h4l2 2"/><path d="M12 22v-3"/><path d="M7 19c-1.5-1.5-3-3.5-3-6 0-4.4 3.6-8 8-8s8 3.6 8 8c0 2.5-1.5 4.5-3 6"/><path d="M10 19h4"/><path d="m14 19 1 3"/><path d="m10 19-1 3"/>
  </svg>
);
