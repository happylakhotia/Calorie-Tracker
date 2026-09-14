import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Send, Trash2, Bot, User, Loader2, Sparkles, Mic, MicOff, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../api';
import { getApiError } from '../utils/helpers';

// ── Design tokens matching NourishLoop ─────────────────────────────────────────
const T = {
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  surface3: 'oklch(0.935 0.033 122)',
  border: 'oklch(0.9 0.024 120)',
  borderLight: 'oklch(0.93 0.018 115)',
  primary: 'oklch(0.48 0.098 155)',
  primaryDark: 'oklch(0.40 0.095 152)',
  primaryLight: 'oklch(0.92 0.06 160)',
  mint: 'oklch(0.88 0.08 165)',
  mintFg: 'oklch(0.32 0.07 165)',
  warning: 'oklch(0.75 0.13 70)',
  danger: 'oklch(0.6 0.2 25)',
  text: 'oklch(0.24 0.032 152)',
  secondary: 'oklch(0.34 0.06 155)',
  muted: 'oklch(0.53 0.028 145)',
};

const CHAT_STORAGE_KEY = 'nutritrack_chat_messages_cache';

const QUICK_ACTIONS = [
  { icon: '🥗', text: 'Log: 2 boiled eggs and avocado toast' },
  { icon: '🔥', text: 'How many calories do I have left today?' },
  { icon: '🍽️', text: 'What did I log for lunch today?' },
  { icon: '💪', text: 'Suggest 3 high-protein snack ideas' },
];

const WELCOME_MESSAGE = ` **Hello! I'm NutriBot**, your intelligent AI nutrition & wellness guide. ✨

Here is how I can assist you:
•  **Log Meals Instantly** — Describe what you ate naturally (e.g. *"2 boiled eggs, brown bread and black coffee"*), and I'll record it directly to your log!
•  **Macro & Nutrition Insights** — Ask about calorie counts, protein/fat ratios, or healthy ingredient alternatives.
•  **Daily & Weekly Summaries** — Review your energy balance, remaining calories, and macro progress.
•  **Goal Tracking & Advice** — Stay aligned with your calorie deficits, surplus, or maintenance targets.

What did you have to eat today, or what would you like to ask?`;

/**
 * Robust markdown to clean HTML parser for chat bubbles
 * Handles hashtags (###, ##, #), horizontal rules (---, --), nested bullets, bold, italics, etc.
 */
function renderFormattedMessage(text) {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let inSubList = false;

  const formatInline = (str) => {
    return str
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: oklch(0.22 0.035 152); font-weight: 700;">$1</strong>')
      .replace(/__(.+?)__/g, '<strong style="color: oklch(0.22 0.035 152); font-weight: 700;">$1</strong>')
      // Italics
      .replace(/\*(.+?)\*/g, '<em style="color: oklch(0.36 0.05 150);">$1</em>')
      .replace(/_(.+?)_/g, '<em style="color: oklch(0.36 0.05 150);">$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background: oklch(0.95 0.02 110); padding: 2px 5px; border-radius: 4px; font-size: 0.9em; font-family: monospace;">$1</code>');
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line
    if (!trimmed) {
      if (inSubList) {
        html += '</ul>';
        inSubList = false;
      }
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    // Horizontal divider (-- or --- or ***)
    if (/^(\-{2,}|_{2,}|\*{3,})$/.test(trimmed)) {
      if (inSubList) { html += '</ul>'; inSubList = false; }
      if (inList) { html += '</ul>'; inList = false; }
      html += '<hr style="border: none; border-top: 1px solid oklch(0.91 0.02 120); margin: 12px 0 10px;" />';
      continue;
    }

    // Headings: ###, ##, #
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      if (inSubList) { html += '</ul>'; inSubList = false; }
      if (inList) { html += '</ul>'; inList = false; }
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      const fontSize = level === 1 ? '16.5px' : level === 2 ? '15.5px' : '14.5px';
      html += `<div style="font-weight: 700; font-size: ${fontSize}; color: oklch(0.22 0.035 152); margin: 14px 0 6px 0; letter-spacing: -0.2px;">${content}</div>`;
      continue;
    }

    // Sub-bullet (indented 2+ spaces or tabs followed by bullet)
    const isSubBullet = /^\s{2,}[\*\-•\+]\s+(.*)$/.test(rawLine);
    if (isSubBullet) {
      const match = rawLine.match(/^\s{2,}[\*\-•\+]\s+(.*)$/);
      const content = formatInline(match[1]);
      if (!inSubList) {
        html += '<ul style="margin: 3px 0 6px 18px; padding-left: 14px; list-style-type: circle;">';
        inSubList = true;
      }
      html += `<li style="margin-bottom: 4px; line-height: 1.55; color: oklch(0.28 0.03 150);">${content}</li>`;
      continue;
    }

    // Main Bullet list item
    const isBullet = /^[\*\-•\+]\s+(.*)$/.test(trimmed);
    if (isBullet) {
      if (inSubList) {
        html += '</ul>';
        inSubList = false;
      }
      const match = trimmed.match(/^[\*\-•\+]\s+(.*)$/);
      const content = formatInline(match[1]);
      if (!inList) {
        html += '<ul style="margin: 6px 0 8px 0; padding-left: 20px; list-style-type: disc;">';
        inList = true;
      }
      html += `<li style="margin-bottom: 6px; line-height: 1.58; color: oklch(0.25 0.032 152);">${content}</li>`;
      continue;
    }

    // Regular text / paragraph line
    if (inSubList) { html += '</ul>'; inSubList = false; }
    if (inList) { html += '</ul>'; inList = false; }

    const content = formatInline(trimmed);
    html += `<p style="margin: 0 0 8px 0; line-height: 1.62; color: oklch(0.25 0.032 152);">${content}</p>`;
  }

  if (inSubList) html += '</ul>';
  if (inList) html += '</ul>';

  return html;
}

const sortMessagesChronologically = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA && timeB && timeA !== timeB) return timeA - timeB;
    if (a.role === 'user' && b.role === 'assistant') return -1;
    if (a.role === 'assistant' && b.role === 'user') return 1;
    return 0;
  });
};

export default function ChatPage() {
  // Initialize state immediately from cache if available to prevent flash on reload
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortMessagesChronologically(parsed);
        }
      }
    } catch (_) { }
    return [{ role: 'assistant', content: WELCOME_MESSAGE }];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat history from backend on mount and sync cache
  useEffect(() => {
    aiApi.getChatHistory()
      .then(({ data }) => {
        if (data.data && data.data.length > 0) {
          const loaded = sortMessagesChronologically(
            data.data.map((m) => ({
              role: m.role,
              content: m.content,
              id: m.id,
              actions: m.actions,
              createdAt: m.createdAt,
            }))
          );
          setMessages(loaded);
          try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(loaded));
          } catch (_) { }
        }
      })
      .catch((err) => {
        console.warn('Failed to load chat history from API:', err);
      })
      .finally(() => setLoadingHistory(false));
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    // Stop listening if mic is active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);

    const now = new Date();
    const userMsg = { role: 'user', content: text, createdAt: now.toISOString() };
    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(updatedWithUser));
    } catch (_) { }

    setInput('');
    setLoading(true);

    try {
      const { data } = await aiApi.chat({ message: text });
      const aiMsg = {
        role: 'assistant',
        content: data.data.response,
        actions: data.data.actions,
        executedEntries: data.data.executedEntries,
        createdAt: new Date(now.getTime() + 100).toISOString(),
      };
      const finalMessages = [...updatedWithUser, aiMsg];
      setMessages(finalMessages);
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(finalMessages));
      } catch (_) { }

      if (data.data.executedEntries?.length > 0) {
        toast.success(`✅ Automatically logged ${data.data.executedEntries.length} meal item(s)!`);
      }
    } catch (err) {
      const msg = getApiError(err);
      const errorMsg = {
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${msg}`,
        createdAt: new Date(now.getTime() + 100).toISOString(),
      };
      const finalMessages = [...updatedWithUser, errorMsg];
      setMessages(finalMessages);
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(finalMessages));
      } catch (_) { }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Voice Input Speech Recognition ──
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser. Please use Chrome or Edge.', { icon: '🎙️' });
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      const initialText = input.trim();

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(initialText ? `${initialText} ${transcript}` : transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone access denied. Please grant permission in your browser.');
        } else if (event.error !== 'no-speech') {
          toast.error(`Voice error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      toast.error('Could not activate microphone.');
      setIsListening(false);
    }
  };

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const clearHistory = async () => {
    if (!confirm('Clear all chat history?')) return;
    try {
      await aiApi.clearChatHistory();
      const freshWelcome = [{
        role: 'assistant',
        content: WELCOME_MESSAGE,
      }];
      setMessages(freshWelcome);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(freshWelcome));
      toast.success('Chat history cleared.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="chat-page-root animate-fade-in">
      <style>{`
        .chat-page-root {
          background: ${T.bg};
          height: calc(100vh - var(--topbar-height, 64px));
          max-height: calc(100vh - var(--topbar-height, 64px));
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 20px 24px;
          box-sizing: border-box;
          width: 100%;
        }
        @media (max-width: 768px) {
          .chat-page-root {
            height: 100% !important;
            max-height: 100% !important;
            padding: 8px 10px 10px !important;
          }
          .chat-bot-avatar {
            width: 36px !important;
            height: 36px !important;
            border-radius: 10px !important;
          }
          .chat-bot-title {
            font-size: 18px !important;
          }
          .chat-header-desc {
            display: none !important;
          }
          .chat-main-card {
            border-radius: 16px !important;
          }
          .chat-msg-row {
            max-width: 92% !important;
            gap: 8px !important;
          }
        }
      `}</style>
      <div style={{
        maxWidth: 1080,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: 10,
      }}>

        {/* ── Fixed Page Header (Never scrolls) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chat-bot-avatar" style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, oklch(0.92 0.06 160), oklch(0.85 0.09 165))',
              border: `1px solid oklch(0.78 0.09 160 / 0.6)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.primaryDark,
              boxShadow: '0 2px 8px rgba(45,90,67,0.12)',
              flexShrink: 0,
            }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h1 className="chat-bot-title" style={{ fontSize: 21, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.3px' }}>
                  NutriBot AI
                </h1>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'oklch(0.88 0.08 165 / 0.35)',
                  color: T.primaryDark,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  border: `1px solid oklch(0.88 0.08 165 / 0.6)`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.primary }} />
                  Gemini AI
                </span>
              </div>
              <p className="chat-header-desc" style={{ fontSize: 12, color: T.muted, marginTop: 2, margin: 0 }}>
                Natural meal logging, calorie estimations & nutrition coaching
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={clearHistory}
            id="btn-clear-chat"
            style={{ fontSize: 12.5, gap: 5, padding: '6px 12px', borderRadius: 10, flexShrink: 0 }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>

        {/* ── Main Chat Card (Card frame is fixed; only the inner messages feed scrolls) ── */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}>

          {/* ── Scrollable Messages Feed (ONLY this part scrolls) ── */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: isUser ? '78%' : '86%',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: isUser
                      ? 'linear-gradient(135deg, oklch(0.48 0.098 155), oklch(0.38 0.095 150))'
                      : 'linear-gradient(135deg, oklch(0.92 0.06 160), oklch(0.85 0.09 165))',
                    color: isUser ? '#FFFFFF' : T.primaryDark,
                    border: isUser ? 'none' : `1px solid oklch(0.78 0.09 160 / 0.5)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow: isUser ? '0 2px 8px rgba(45,90,67,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {isUser ? <User size={19} /> : <Bot size={21} />}
                  </div>

                  {/* Chat Bubble with improved typography, contrast & styling */}
                  <div style={{
                    background: isUser
                      ? 'linear-gradient(135deg, oklch(0.48 0.098 155), oklch(0.42 0.09 150))'
                      : '#FFFFFF',
                    color: isUser ? '#FFFFFF' : T.text,
                    border: isUser ? 'none' : `1.5px solid ${T.borderLight}`,
                    borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                    padding: '16px 20px',
                    fontSize: 14.5,
                    lineHeight: 1.62,
                    boxShadow: isUser
                      ? '0 3px 12px rgba(45,90,67,0.22)'
                      : '0 2px 10px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)',
                  }}>
                    {isUser ? (
                      <div style={{ wordBreak: 'break-word', fontWeight: 500, fontSize: 14.5 }}>
                        {msg.content}
                      </div>
                    ) : (
                      <>
                        <div
                          dangerouslySetInnerHTML={{ __html: renderFormattedMessage(msg.content) }}
                          style={{ wordBreak: 'break-word' }}
                        />
                        {msg.executedEntries && msg.executedEntries.length > 0 && (
                          <div style={{
                            marginTop: 14,
                            padding: '12px 16px',
                            background: 'oklch(0.88 0.08 165 / 0.18)',
                            border: '1.5px solid oklch(0.48 0.098 155 / 0.35)',
                            borderRadius: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: T.primaryDark, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle2 size={16} color={T.primary} />
                                Automatically Logged to Database
                              </span>
                              <Link
                                to="/dashboard"
                                style={{ fontSize: 12, fontWeight: 700, color: T.primary, textDecoration: 'none' }}
                              >
                                View on Dashboard &rarr;
                              </Link>
                            </div>
                            {msg.executedEntries.map((e, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#FFFFFF',
                                padding: '9px 14px',
                                borderRadius: 10,
                                border: `1px solid ${T.borderLight}`,
                                fontSize: 13,
                                flexWrap: 'wrap',
                                gap: 6,
                              }}>
                                <div style={{ fontWeight: 700, color: T.text }}>
                                  {e.foodName} <span style={{ fontWeight: 500, color: T.muted, fontSize: 12 }}>({e.quantity} {e.unit} · {e.mealType})</span>
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.secondary }}>
                                  🔥 {e.calories} kcal · P: {e.protein}g · C: {e.carbs}g · F: {e.fat}g
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Loading Bubble */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, alignSelf: 'flex-start' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, oklch(0.92 0.06 160), oklch(0.85 0.09 165))',
                  color: T.primaryDark,
                  border: `1px solid oklch(0.78 0.09 160 / 0.5)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  <Bot size={21} />
                </div>
                <div style={{
                  background: '#FFFFFF',
                  border: `1.5px solid ${T.borderLight}`,
                  borderRadius: '4px 18px 18px 18px',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  color: T.muted,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}>
                  <Loader2 size={16} style={{ animation: 'spin 1.2s linear infinite', color: T.primary }} />
                  <span>NutriBot is analyzing and preparing reply…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Fixed Footer Controls: Quick Actions & Input Bar ── */}
          <div style={{
            borderTop: `1px solid ${T.border}`,
            padding: '14px 24px 16px',
            background: T.surface,
            flexShrink: 0,
          }}>
            {/* Quick action suggestions */}
            {messages.length <= 2 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(action.text)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 99,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: T.surface2,
                      color: T.secondary,
                      border: `1px solid ${T.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.primary;
                      e.currentTarget.style.background = 'oklch(0.88 0.08 165 / 0.25)';
                      e.currentTarget.style.color = T.primaryDark;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.background = T.surface2;
                      e.currentTarget.style.color = T.secondary;
                    }}
                  >
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: T.surface2,
              border: isListening ? '1.5px solid oklch(0.6 0.2 25)' : `1.5px solid ${T.border}`,
              borderRadius: 16,
              padding: '6px 8px 6px 16px',
              transition: 'all 0.2s ease',
              boxShadow: isListening ? '0 0 0 3px oklch(0.6 0.2 25 / 0.15)' : 'none',
            }}>
              <input
                ref={inputRef}
                type="text"
                placeholder={isListening ? "Listening… speak to NutriBot…" : "Ask NutriBot or log a meal (e.g. 'I ate 150g salmon with brown rice for dinner')…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                id="chat-input"
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 14.5,
                  color: T.text,
                }}
              />

              {/* Voice-to-Text Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                id="btn-mic-chat"
                title={isListening ? 'Listening… click to stop' : 'Click to speak'}
                disabled={loading}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  border: 'none',
                  background: isListening ? 'oklch(0.6 0.2 25 / 0.12)' : 'transparent',
                  color: isListening ? 'oklch(0.6 0.2 25)' : T.muted,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.18s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isListening) {
                    e.currentTarget.style.color = T.text;
                    e.currentTarget.style.background = T.surface;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isListening) {
                    e.currentTarget.style.color = T.muted;
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {isListening ? (
                  <MicOff size={19} style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                ) : (
                  <Mic size={19} />
                )}
                {isListening && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'oklch(0.6 0.2 25)',
                      boxShadow: '0 0 6px oklch(0.6 0.2 25)',
                    }}
                  />
                )}
              </button>

              {/* Send Button */}
              <button
                className="btn btn-primary"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                id="btn-send-chat"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(45,90,67,0.2)',
                }}
              >
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} /> : <Send size={18} />}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
