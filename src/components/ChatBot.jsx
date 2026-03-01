import { useState, useRef, useEffect } from 'react';
import { chatCompletion } from '../lib/minimax.js';
import '../css/ChatBot.css';

const CHAT_SYSTEM = 'You are a friendly study and productivity assistant for MindStudy AI. You help users with study planning, focus, deadlines, and well-being. Keep replies concise and practical.';

export default function ChatBot({ isLoggedIn = true, onOpenSignUp, onOpenLogIn }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your MindStudy AI assistant. Ask me about planning, focus, or your study plan." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const apiMessages = [
        { role: 'system', content: CHAT_SYSTEM },
        ...messages.slice(-10).map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: text },
      ];
      const reply = await chatCompletion(apiMessages);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Sorry, I couldn't reach the assistant right now. (${err.message})` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="chatbot-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <span className="chatbot-fab-icon" aria-hidden>
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          )}
        </span>
      </button>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span>MindStudy AI Assistant</span>
          </div>
          <div className="chatbot-body">
            <div className="chatbot-messages" ref={listRef}>
              {messages.map((msg, i) => (
                <div key={i} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div className="chatbot-msg chatbot-msg--assistant chatbot-msg--loading">
                  …
                </div>
              )}
            </div>
            <form className="chatbot-form" onSubmit={handleSend}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()}>
                Send
              </button>
            </form>
            {!isLoggedIn && (
              <div className="chatbot-login-overlay" aria-hidden>
                <div className="chatbot-login-gate">
                  <p className="chatbot-login-text">Log in or sign up to chat with the assistant.</p>
                  <div className="chatbot-login-actions">
                    <button type="button" className="chatbot-login-btn chatbot-login-btn--primary" onClick={onOpenSignUp}>
                      Sign up
                    </button>
                    <button type="button" className="chatbot-login-btn chatbot-login-btn--secondary" onClick={onOpenLogIn}>
                      Log in
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
