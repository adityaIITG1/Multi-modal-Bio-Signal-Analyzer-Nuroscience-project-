import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSpacebarBlinkControl } from '@/hooks/useSpacebarBlinkControl';
import { useAutoSelectTimer } from '@/hooks/useAutoSelectTimer';
import { SingleSwitchScanner } from './SingleSwitchScanner';
import { VoiceFeedback } from '@/lib/VoiceFeedback';
import { MessageSquare, LogOut, RefreshCw, Send, AlertTriangle, ArrowLeft } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/whatsapp';

export function WhatsAppBlinkAssist({ onClose, speak }: { onClose: () => void, speak?: (text: string) => void }) {
  const [waStatus, setWaStatus] = useState('INITIALIZING');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [aiReplies, setAiReplies] = useState<string[]>([]);
  const [previewReply, setPreviewReply] = useState<string>('');
  
  const [view, setView] = useState<'LOGIN' | 'MAIN' | 'CHAT_LIST' | 'CHAT_DETAIL' | 'AI_REPLIES' | 'CONFIRM_LOGOUT'>('LOGIN');

  const playVoice = useCallback((text: string) => {
    if (speak) speak(text);
    else VoiceFeedback.speak(text);
  }, [speak]);

  // Status Polling
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        setWaStatus(data.status);
        
        if (data.status === 'QR_READY' && data.qrCode) {
          setQrCode(data.qrCode);
          setView('LOGIN');
        } else if (data.status === 'CONNECTED' && view === 'LOGIN') {
          setView('MAIN');
          playVoice("WhatsApp Connected.");
        } else if (data.status === 'DISCONNECTED') {
          setView('LOGIN');
        }
      } catch (err) {
        setWaStatus('SERVER ERROR');
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [view]);

  const generateAIReplies = async (messageToReplyTo: string) => {
    playVoice("Generating AI Replies. Please wait.");
    try {
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a smart, natural-sounding AI assistant helping a user reply to a WhatsApp message.
The message received is: "${messageToReplyTo}"
Generate EXACTLY 4 distinct, highly natural, and conversational reply options.
The options should cover different tones:
1. Positive/Agreeing
2. Polite Decline/Busy
3. Short/Neutral acknowledgment
4. Casual/Friendly/Funny

Write the replies exactly as a human would type them on WhatsApp (short, natural, use emojis occasionally, no robotic tone).
Match the exact language of the received message (Hindi, Hinglish, or English).
IMPORTANT: Separate the 4 options using EXACTLY "|||" between them. Do not include numbering, bullet points, quotes, or any extra text.`
        })
      });
      const data = await res.json();
      if (data.reply) {
        const replies = data.reply.split('|||').map((r: string) => r.trim()).filter((r: string) => r);
        setAiReplies(replies.slice(0, 4));
        setView('AI_REPLIES');
        playVoice("AI Replies Ready. Choose an option.");
      }
    } catch (err) {
      playVoice("Failed to generate replies.");
    }
  };

  const handleSend = async () => {
    if (!activeChat || !previewReply) {
      playVoice("Cannot send empty message.");
      return;
    }
    playVoice("Sending message...");
    try {
      const res = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat.id, message: previewReply })
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || "Server error");
      }
      
      playVoice("Message sent successfully.");
      setPreviewReply('');
      setView('CHAT_DETAIL');
    } catch (err: any) {
      console.error("Send Error:", err);
      playVoice("Failed to send message.");
    }
  };

  // Define options based on current view
  const currentOptions = useMemo(() => {
    if (view === 'LOGIN') {
      return waStatus === 'QR_READY' ? [
        { id: 'retry', label: 'Refresh QR', action: () => window.location.reload() }
      ] : [];
    }
    
    if (view === 'MAIN') {
      return [
        { id: 'open_chats', label: 'Open Chat List', action: () => {
          fetch(`${API_BASE}/chats`).then(r => r.json()).then(d => { setChats(d.slice(0, 10)); setView('CHAT_LIST'); playVoice("Chat List Opened."); });
        }},
        { id: 'logout', label: 'Logout WhatsApp', action: () => { setView('CONFIRM_LOGOUT'); playVoice("Confirm logout?"); } },
        { id: 'exit_os', label: 'Exit to Main OS', action: () => { playVoice("Exiting WhatsApp Assist."); onClose(); } }
      ];
    }

    if (view === 'CHAT_LIST') {
      const chatOpts = chats.map(c => ({
        id: c.id, 
        label: c.name, 
        action: () => {
          setActiveChat(c);
          fetch(`${API_BASE}/chats/${c.id}/messages`).then(r => r.json()).then(m => {
            setChatMessages(m);
            setView('CHAT_DETAIL');
            playVoice(`Chat opened: ${c.name}`);
          });
        }
      }));
      return [...chatOpts, { id: 'back_main', label: 'Back', action: () => { setView('MAIN'); setActiveChat(null); setPreviewReply(''); playVoice("Back to Main Menu."); } }];
    }

    if (view === 'CHAT_DETAIL') {
      const latestMessage = chatMessages[chatMessages.length - 1]?.body || "No new messages";
      
      // If a message is ready, prioritize sending it.
      if (previewReply) {
        return [
          { id: 'send_msg', label: 'Send Message Now', action: handleSend },
          { id: 'cancel_send', label: 'Cancel Message', action: () => { setPreviewReply(''); playVoice("Message cancelled."); } }
        ];
      }

      return [
        { id: 'read_msg', label: 'Read Latest Message', action: () => playVoice(`Latest message: ${latestMessage}`) },
        { id: 'gen_reply', label: 'Generate AI Replies', action: () => generateAIReplies(latestMessage) },
        { id: 'emerg_msg', label: 'Emergency Message', action: () => { setPreviewReply("I need help immediately."); setView('AI_REPLIES'); playVoice("Emergency message selected. Ready to send?"); } },
        { id: 'back_list', label: 'Back to Chats', action: () => { setView('CHAT_LIST'); setActiveChat(null); setPreviewReply(''); playVoice("Back to Chats."); } }
      ];
    }

    if (view === 'AI_REPLIES') {
      const repOpts = aiReplies.map((r, i) => ({
        id: `reply_${i}`,
        label: r,
        action: () => { setPreviewReply(r); setView('CHAT_DETAIL'); playVoice("Reply selected. Please review and send."); }
      }));
      return [
        ...repOpts,
        { id: 'send_preview', label: 'Send Current Preview', action: handleSend },
        { id: 'cancel_reply', label: 'Cancel', action: () => { setPreviewReply(''); setView('CHAT_DETAIL'); playVoice("Cancelled."); } }
      ];
    }

    if (view === 'CONFIRM_LOGOUT') {
      return [
        { id: 'confirm', label: 'Confirm Logout', action: async () => {
            await fetch(`${API_BASE}/logout`, { method: 'POST' });
            setView('LOGIN');
            playVoice("WhatsApp Logged Out.");
        }},
        { id: 'cancel', label: 'Cancel', action: () => { setView('MAIN'); playVoice("Logout Cancelled."); } }
      ];
    }

    return [];
  }, [view, waStatus, chats, chatMessages, aiReplies, previewReply, activeChat]);

  // Hook integrations
  const { currentIndex } = useSpacebarBlinkControl(currentOptions.length, currentOptions.length > 0);
  
  const handleAutoSelect = useCallback(() => {
    if (currentOptions[currentIndex]) {
      currentOptions[currentIndex].action();
    }
  }, [currentIndex, currentOptions]);

  const progress = useAutoSelectTimer(currentIndex, handleAutoSelect, currentOptions.length > 0, 4000);

  // Announce highlighted option
  useEffect(() => {
    if (currentOptions[currentIndex]) {
      playVoice(currentOptions[currentIndex].label);
    }
  }, [currentIndex, currentOptions]);

  // Auto-scroll to active option
  useEffect(() => {
    const activeEl = document.getElementById(`wa-option-${currentIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-[#0f172a] via-[#091121] to-[#041a28] text-slate-100 rounded-[2.5rem] overflow-hidden p-10 shadow-[0_0_80px_rgba(34,211,238,0.15)] border border-white/10 relative">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-8 relative z-10">
        <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center gap-5 tracking-tight">
          <MessageSquare className="w-12 h-12 text-cyan-400" />
          WhatsApp Blink Assist
        </h1>
        <div className={`px-6 py-3 rounded-full text-lg font-bold tracking-widest uppercase border backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] ${waStatus === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
          {waStatus}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
        {view === 'LOGIN' && (
          <div className="flex flex-col items-center justify-center h-full">
            <h2 className="text-3xl mb-8 font-extrabold text-slate-200 tracking-tight">WhatsApp Secure Login</h2>
            {qrCode ? (
              <div className="p-6 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.3)]">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-80 h-80 bg-white p-4 rounded-xl shadow-inner" />
              </div>
            ) : (
              <div className="animate-pulse text-cyan-400 font-bold text-2xl tracking-widest uppercase">Initializing Secure Connection...</div>
            )}
            <p className="mt-10 text-slate-400 text-lg max-w-xl text-center leading-relaxed">Ask your caregiver to scan this QR code using the WhatsApp app on your phone. <br/><span className="text-emerald-400 font-medium">You will stay logged in permanently.</span></p>
          </div>
        )}

        {(view !== 'LOGIN') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 h-full">
            
            {/* Left Panel: Context/Preview */}
            <div className="bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col h-full">
              {view === 'CONFIRM_LOGOUT' ? (
                <div className="text-center text-rose-400 font-bold text-2xl flex flex-col items-center gap-4 py-10">
                  <AlertTriangle className="w-16 h-16" />
                  Are you sure you want to logout?
                </div>
              ) : activeChat ? (
                <div>
                  <h3 className="text-2xl font-bold text-cyan-300 mb-4">{activeChat.name}</h3>
                  <div className="h-64 overflow-y-auto bg-slate-900/50 p-4 rounded-xl space-y-4 mb-4 border border-slate-700 custom-scrollbar">
                    {chatMessages.length === 0 ? <p className="text-slate-500">No messages found.</p> : null}
                    {chatMessages.map((m: any, i) => (
                      <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.fromMe ? 'bg-cyan-900/40 text-cyan-100 ml-auto' : 'bg-slate-700/50 text-slate-200'}`}>
                        {m.body || '[Media/System Message]'}
                      </div>
                    ))}
                  </div>
                  
                  {previewReply && (
                    <div className="bg-emerald-900/30 border border-emerald-500 p-4 rounded-xl">
                      <p className="text-emerald-400 font-bold mb-2">Message Ready to Send:</p>
                      <p className="text-xl">{previewReply}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-xl">Select a chat to begin.</p>
                </div>
              )}
            </div>

            {/* Right Panel: Auto-Scanning Options */}
            <div className="bg-white/5 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col h-full">
              <h3 className="text-3xl font-extrabold text-slate-200 mb-6 px-2 flex items-center justify-between">
                <span>Scanning Options</span>
                <span className="text-sm font-bold bg-slate-900/80 px-4 py-2 rounded-full border border-white/10 tracking-widest text-cyan-400 uppercase shadow-inner">Wait 4s to select</span>
              </h3>
              <div className="flex-1 overflow-y-auto pr-4 space-y-5 custom-scrollbar relative pb-10">
                {currentOptions.map((opt, i) => (
                  <div id={`wa-option-${i}`} key={opt.id} className="scroll-mt-4">
                    <SingleSwitchScanner isFocused={currentIndex === i} progress={currentIndex === i ? progress : 0}>
                      <div className={`text-2xl font-bold p-2 ${opt.id === 'logout' || opt.id === 'confirm' ? 'text-rose-400' : opt.id === 'send_msg' || opt.id === 'send_preview' ? 'text-emerald-400' : 'text-slate-200'} ${currentIndex === i ? 'scale-[1.02]' : ''} transition-transform`}>
                        {opt.label}
                      </div>
                    </SingleSwitchScanner>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
