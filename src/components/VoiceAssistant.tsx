import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Mic, 
  X, 
  Check, 
  Volume2, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseVoiceCommand } from '../services/aiService';

export function VoiceAssistant({ onCommand }: { onCommand: (result: any) => void }) {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    // @ts-ignore
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    
    recognition.lang = i18n.language === 'ur' ? 'ur-PK' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setFeedback(null);
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      
      setProcessing(true);
      try {
        const result = await parseVoiceCommand(text, i18n.language);
        setFeedback(result.confirmation);
        
        // TTS feedback
        const utterance = new SpeechSynthesisUtterance(result.confirmation);
        utterance.lang = i18n.language === 'ur' ? 'ur-PK' : 'en-US';
        window.speechSynthesis.speak(utterance);
        
        setTimeout(() => {
          onCommand(result);
          setProcessing(false);
        }, 2000);
      } catch (error) {
        console.error(error);
        setProcessing(false);
        setFeedback("Koshish karein dobara. (Please try again)");
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <AnimatePresence>
        {(isListening || processing || feedback) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 mb-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {processing ? t('loading') : isListening ? t('voice_assistant') : 'SmartKhata AI'}
              </span>
              <button onClick={() => { setIsListening(false); setFeedback(null); }} className="text-slate-400">
                <X size={16} />
              </button>
            </div>
            
            <div className="py-2">
              {isListening && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1 items-end h-8">
                    {[1,2,3,4,5].map(i => (
                      <motion.div
                        key={i}
                        animate={{ height: [10, 24, 10] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                        className="w-1.5 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                  <p className="text-slate-600 text-sm italic">{t('voice_help')}</p>
                </div>
              )}
              
              {transcript && !feedback && (
                <p className="text-slate-800 font-medium">"{transcript}"</p>
              )}
              
              {feedback && (
                <div className="flex items-start gap-2 bg-primary-light/30 p-3 rounded-lg border border-primary-light">
                  <Volume2 size={18} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-slate-900 leading-relaxed">{feedback}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={startListening}
        className={cn(
          "w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-colors border-4",
          isListening ? "bg-red-500 border-red-100" : "bg-primary border-primary-light"
        )}
      >
        <Mic size={28} className="text-white" />
      </motion.button>
    </div>
  );
}

// Helper to use in other files
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
