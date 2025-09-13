import React, { useState, useEffect, useCallback } from 'react';
import { translateThought } from './services/geminiService';
import { Tone, HistoryEntry } from './types';
import { SparklesIcon, CopyIcon, CheckIcon, TrashIcon, MicrophoneIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from './components/icons';

// Web Speech API interfaces
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    SpeechGrammarList: any;
    webkitSpeechGrammarList: any;
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = true;
  recognition.interimResults = true;
}

const App: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [tone, setTone] = useState<Tone>(Tone.Friendly);
  const [outputLanguage, setOutputLanguage] = useState<string>('English');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);


  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('translationHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('translationHistory', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);

  // Global keydown listener to focus input
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Don't steal focus from other inputs/textareas/buttons
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) {
        return;
      }
      // Also check for contentEditable elements
      if (target.isContentEditable) {
        return;
      }
      
      // Allow modifier keys without focusing
      if (event.key.length > 1 && event.key !== 'Enter') return;


      inputRef.current?.focus();
    };


    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setOutput('');
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    }

    try {
      const result = await translateThought(input, tone, outputLanguage);
      setOutput(result);
      
      // Automatically copy the result
      if (result) {
        navigator.clipboard.writeText(result);
        setCopiedId('current');
        setTimeout(() => setCopiedId(null), 2000);
      }

      const newEntry: HistoryEntry = {
        id: new Date().toISOString(),
        input,
        output: result,
        tone,
        outputLanguage,
        timestamp: Date.now(),
      };
      setHistory(prev => [newEntry, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      setOutput("Sorry, something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [input, tone, outputLanguage, isLoading, isListening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };
  
  const handleClearHistory = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Revert after 3 seconds
    } else {
      setHistory([]);
      setConfirmClear(false);
    }
  };

  const toggleListening = () => {
    if (!recognition) {
        setError("Speech recognition is not supported in your browser.");
        return;
    }
    if (isListening) {
        recognition.stop();
        setIsListening(false);
    } else {
        recognition.lang = 'en-US'; // Can be adapted
        recognition.start();
        setIsListening(true);
    }
  };

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        setInput(input + finalTranscript + interimTranscript);
    };
    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
    };
    recognition.onend = () => {
        setIsListening(false);
    }
    return () => {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
    }
  }, [input]);

  const handleSpeak = () => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
    }

    if (output && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(output);
      // Map language names to BCP 47 codes
      const langCode = {
        'English': 'en-US',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'German': 'de-DE',
        'Italian': 'it-IT',
        'Japanese': 'ja-JP',
        'Korean': 'ko-KR',
        'Russian': 'ru-RU',
        'Chinese (Simplified)': 'zh-CN',
      }[outputLanguage] || 'en-US';
      
      utterance.lang = langCode;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        setError("Sorry, text-to-speech is not available for this language.");
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    } else {
        setError("Text-to-speech is not supported in your browser.");
    }
  };


  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Russian', 'Chinese (Simplified)'
  ];

  const loadFromHistory = (entry: HistoryEntry) => {
    setInput(entry.input);
    setOutput(entry.output);
    setTone(entry.tone);
    setOutputLanguage(entry.outputLanguage);
  };

  return (
    <div className="bg-zinc-900 text-zinc-200 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Interaction Column */}
        <div className="lg:col-span-2 space-y-8">
          <header className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff91af] to-rose-400">
              Thought Translator
            </h1>
            <p className="text-zinc-400 mt-2">
              Untangle your thoughts. Write clearly, in any language.
            </p>
          </header>

          <main className="space-y-6">
            {/* Input Card */}
            <div className="bg-zinc-800/50 p-6 rounded-xl shadow-lg border border-zinc-700">
              <div className="flex justify-between items-center mb-3">
                <label htmlFor="input" className="text-lg font-semibold text-zinc-300">
                  Your Raw Thoughts
                </label>
                <button
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-colors duration-200 ${isListening ? 'bg-red-500/80 text-white animate-pulse' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                    <MicrophoneIcon className="w-5 h-5" />
                </button>
              </div>
              <textarea
                id="input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Jot down anything... a messy idea, a quick note, or a sentence in another language. Press Enter to translate."
                className="w-full h-36 p-3 bg-zinc-900/70 border border-zinc-600 rounded-lg focus:ring-2 focus:ring-[#ff91af] focus:border-[#ff91af] transition-colors duration-200 resize-none"
                rows={6}
              />
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Tone</label>
                    <div className="flex flex-wrap gap-2">
                    {Object.values(Tone).map((t) => (
                        <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`px-4 py-2 rounded-full text-sm transition-colors duration-200 ${
                            tone === t
                            ? 'bg-[#ff91af] text-zinc-900 font-semibold shadow-md'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        }`}
                        >
                        {t}
                        </button>
                    ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="language" className="block text-sm font-medium text-zinc-400 mb-2">
                        Output Language
                    </label>
                    <select
                        id="language"
                        value={outputLanguage}
                        onChange={(e) => setOutputLanguage(e.target.value)}
                        className="w-full p-2.5 bg-zinc-700 border border-zinc-600 rounded-lg focus:ring-2 focus:ring-[#ff91af] focus:border-[#ff91af] transition-colors duration-200 appearance-none"
                        style={{ background: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16"><path d="M8 12L2 6h12z"/></svg>\') no-repeat right 0.75rem center/10px 10px', paddingRight: '2.5rem' }}
                    >
                        {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="w-full flex items-center justify-center gap-x-2 px-6 py-3 bg-gradient-to-r from-[#ff91af] to-rose-500 hover:from-[#fd80a2] hover:to-rose-600 text-white font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              {isLoading ? (
                <>
                  <SparklesIcon className="w-5 h-5 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Translate Thought
                </>
              )}
            </button>

            {error && <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-lg border border-red-800">{error}</div>}

            {/* Output Card */}
            {(isLoading || output) && (
              <div className="bg-zinc-800/50 p-6 rounded-xl shadow-lg border border-zinc-700">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold text-zinc-300">Polished Version</h2>
                    {output && (
                         <div className="flex items-center gap-x-2">
                             <button
                                 onClick={handleSpeak}
                                 className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-full transition-colors"
                                 aria-label={isSpeaking ? "Stop speaking" : "Read aloud"}
                             >
                                 {isSpeaking ? <SpeakerXMarkIcon className="w-5 h-5 text-red-400"/> : <SpeakerWaveIcon className="w-5 h-5"/>}
                             </button>
                             <button
                                 onClick={() => handleCopy(output, 'current')}
                                 className="flex items-center gap-x-1.5 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-full transition-colors"
                                 aria-label="Copy result"
                             >
                                 {copiedId === 'current' ? <><CheckIcon className="w-4 h-4 text-green-400" /> Copied!</> : <><CopyIcon className="w-4 h-4" /> Copy</>}
                             </button>
                         </div>
                    )}
                </div>
                <div className="relative min-h-[100px] bg-zinc-900/70 p-4 rounded-lg">
                    {isLoading && !output && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <SparklesIcon className="w-8 h-8 text-[#ff91af] animate-pulse" />
                        </div>
                    )}
                    <p className="whitespace-pre-wrap text-zinc-300">{output}</p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* History Column */}
        <aside className="lg:col-span-1">
          <div className="sticky top-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-zinc-300">History</h2>
              {history.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className={`px-3 py-1 text-sm rounded-full transition-colors duration-300 ${
                    confirmClear ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-red-500/80 hover:text-white'
                  }`}
                >
                  {confirmClear ? "Click to Confirm" : "Clear All"}
                </button>
              )}
            </div>
            {history.length === 0 ? (
                <div className="text-center py-10 bg-zinc-800/50 rounded-lg border border-dashed border-zinc-700">
                    <p className="text-zinc-500">Your translations will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                {history.map((entry) => (
                    <div key={entry.id} className="bg-zinc-800/50 p-4 rounded-xl shadow-md border border-zinc-700 cursor-pointer hover:border-[#ff91af]/50 transition-colors" onClick={() => loadFromHistory(entry)}>
                    <div className="mb-3">
                        <p className="text-sm text-zinc-400 truncate">"{entry.input}"</p>
                    </div>
                    <div className="relative">
                        <p className="text-zinc-300 whitespace-pre-wrap text-sm line-clamp-3">{entry.output}</p>
                        <div className="absolute -top-1 right-0 flex space-x-2 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCopy(entry.output, entry.id); }}
                                className="p-1.5 bg-zinc-600 hover:bg-zinc-500 rounded-full"
                                aria-label="Copy"
                            >
                                {copiedId === entry.id ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteHistory(entry.id); }}
                                className="p-1.5 bg-zinc-600 hover:bg-red-500 rounded-full"
                                aria-label="Delete"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-zinc-500 mt-3 flex justify-between items-center">
                        <span>{entry.tone} | {entry.outputLanguage}</span>
                        <time dateTime={new Date(entry.timestamp).toISOString()}>
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;