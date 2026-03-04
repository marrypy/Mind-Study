import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getSubscriptionTier } from '../lib/subscription.js';
import '../css/Account.css';

export default function Account({ onBack, onGoToPricing }) {
  const { user, signOut, updatePassword, updateUsername } = useAuth();
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [usernameValue, setUsernameValue] = useState(user?.user_metadata?.username || '');
  const [usernameMessage, setUsernameMessage] = useState(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null);
  const tier = getSubscriptionTier(user);
  const isPro = tier === 'pro';

  useEffect(() => {
    setUsernameValue(user?.user_metadata?.username || '');
  }, [user?.user_metadata?.username]);

  async function handleChangeUsername(e) {
    e.preventDefault();
    setUsernameMessage(null);
    const trimmed = (usernameValue || '').trim();
    if (!trimmed) {
      setUsernameMessage('Username cannot be empty.');
      return;
    }
    setUsernameLoading(true);
    try {
      await updateUsername(trimmed);
      setUsernameMessage('Username updated successfully.');
    } catch (err) {
      setUsernameMessage(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMessage(null);
    const { newPassword, confirm } = passwordForm;
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setPasswordMessage('Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
      setPasswordMessage('Password updated successfully.');
      setPasswordForm({ newPassword: '', confirm: '' });
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteClick() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setDeleteMessage(null);
      return;
    }
    setDeleteMessage('Account deletion must be done from your Supabase project (Dashboard → Authentication → Users). You have been signed out.');
    await signOut();
    onBack?.();
  }

  if (!user) return null;

  return (
    <div className="account-page">
      <div className="account-card">
        <h2 className="account-title">Account</h2>

        <div className="account-field">
          <span className="account-label">Email</span>
          <span className="account-value">{user.email}</span>
        </div>

        <div className="account-field">
          <span className="account-label">Username</span>
          <span className="account-value">{user.user_metadata?.username || 'Not set'}</span>
        </div>

        <section className="account-section account-section-plan">
          <h3 className="account-section-title">Manage plan</h3>
          <div className="account-field">
            <span className="account-label">Active subscription</span>
            <span className="account-value account-value-plan">{isPro ? 'Pro' : 'Free'}</span>
          </div>
          {isPro ? (
            <>
              {cancelMessage && (
                <p className={`account-message ${cancelMessage.includes('contact') ? 'account-message--success' : 'account-message--error'}`}>
                  {cancelMessage}
                </p>
              )}
              <button
                type="button"
                className="account-btn account-btn-secondary"
                onClick={() => setCancelMessage('To cancel your Pro subscription, please contact support.')}
              >
                Cancel subscription
              </button>
            </>
          ) : (
            <button
              type="button"
              className="account-btn account-btn-primary"
              onClick={onGoToPricing}
            >
              Upgrade to Pro
            </button>
          )}
        </section>

        <section className="account-section">
          <h3 className="account-section-title">Change username</h3>
          <form className="account-form" onSubmit={handleChangeUsername}>
            <input
              type="text"
              className="account-input"
              placeholder="New username"
              value={usernameValue}
              onChange={(e) => setUsernameValue(e.target.value)}
              autoComplete="username"
            />
            {usernameMessage && (
              <p className={`account-message ${usernameMessage.includes('success') ? 'account-message--success' : 'account-message--error'}`}>
                {usernameMessage}
              </p>
            )}
            <button type="submit" className="account-btn account-btn-primary" disabled={usernameLoading}>
              {usernameLoading ? 'Updating…' : 'Update username'}
            </button>
          </form>
        </section>

        <section className="account-section">
          <h3 className="account-section-title">Change password</h3>
          <form className="account-form" onSubmit={handleChangePassword}>
            <input
              type="password"
              className="account-input"
              placeholder="New password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
              autoComplete="new-password"
            />
            <input
              type="password"
              className="account-input"
              placeholder="Confirm new password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
            {passwordMessage && (
              <p className={`account-message ${passwordMessage.includes('success') ? 'account-message--success' : 'account-message--error'}`}>
                {passwordMessage}
              </p>
            )}
            <button type="submit" className="account-btn account-btn-primary" disabled={passwordLoading}>
              {passwordLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>

        <section className="account-section account-section-danger">
          <h3 className="account-section-title">Danger zone</h3>
          <p className="account-delete-hint">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {deleteConfirm && (
            <p className="account-delete-warn">Click again to sign out. To fully delete your account, use Supabase Dashboard → Authentication → Users.</p>
          )}
          {deleteMessage && <p className="account-message account-message--error">{deleteMessage}</p>}
          <button
            type="button"
            className="account-btn account-btn-danger"
            onClick={handleDeleteClick}
          >
            Delete account
          </button>
        </section>
      </div>

      {onBack && (
        <button type="button" className="account-back" onClick={onBack}>
          ← Back
        </button>
      )}
    </div>
  );
}
