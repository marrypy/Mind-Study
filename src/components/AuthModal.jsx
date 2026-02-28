import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import '../css/AuthModal.css';

const EMAIL_NOT_CONFIRMED = 'email not confirmed';

export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }) {
  const { signUp, signIn } = useAuth();
  const [tab, setTab] = useState(defaultTab);

  useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [isOpen, defaultTab]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const isEmailNotConfirmed = message.text && message.text.toLowerCase().includes(EMAIL_NOT_CONFIRMED);

  async function handleResendConfirmation() {
    if (!email.trim()) return;
    setResendLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Confirmation email sent. Check your inbox (and spam).' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not resend email.' });
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (tab === 'signup' && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUp(email, password);
        setMessage({ type: 'success', text: 'Account created! Check your email to confirm, or sign in below.' });
        setTab('login');
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err) {
      const text = err.message || 'Something went wrong.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={tab === 'login' ? 'active' : ''}
            onClick={() => { setTab('login'); setMessage({ type: '', text: '' }); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={tab === 'signup' ? 'active' : ''}
            onClick={() => { setTab('signup'); setMessage({ type: '', text: '' }); }}
          >
            Sign up
          </button>
        </div>
        <form onSubmit={handleSubmit} className="auth-modal-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>
          {tab === 'signup' && (
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
          )}
          {message.text && (
            <div className="auth-modal-message-wrap">
              <p className={`auth-modal-message auth-modal-message--${message.type}`}>
                {isEmailNotConfirmed
                  ? 'Please confirm your email first. Check your inbox for a confirmation link from us.'
                  : message.text}
              </p>
              {isEmailNotConfirmed && (
                <button
                  type="button"
                  className="auth-modal-resend"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}
          <button type="submit" className="auth-modal-submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
