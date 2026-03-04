import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Lock, ShieldCheck, AlertCircle, Home, MailCheck, KeyRound } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PublicThemeToggle } from '../components/PublicThemeToggle';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

type Step = 'request' | 'verify' | 'reset';

export function ChangePassword() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const body = await apiFetch<{ message?: string }>('/auth/pass', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(body.message ?? 'Reset code sent. Check your email.');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!code.trim()) {
      setError('Please enter the verification code sent to your email');
      return;
    }

    setLoading(true);
    try {
      const body = await apiFetch<{ message?: string }>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ passToken: code.trim() }),
      });
      setSuccess(body.message ?? 'Code verified successfully. Set your new password.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const body = await apiFetch<{ message?: string }>('/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ pass: newPassword, confirm: confirmPassword }),
      });
      setSuccess(body.message ?? 'Password updated successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900 flex items-center justify-center px-4 py-12">
      <div className="fixed right-4 top-4 z-50">
        <PublicThemeToggle />
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-xl shadow-blue-600/30">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h1>
          <p className="text-slate-600 dark:text-slate-300">Recover account access in three quick steps</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/20">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-300" />
              <p className="text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/20">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500 dark:text-emerald-300" />
              <p className="text-emerald-700 dark:text-emerald-200">{success}</p>
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={submitRequest} className="space-y-6">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700 dark:text-white">
                  Account Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MailCheck className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-blue-600/30 disabled:bg-blue-400 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <PumpLoadingIndicator size="sm" label="Sending reset code" />
                ) : (
                  <span>Send Reset Code</span>
                )}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={submitCode} className="space-y-6">
              <div>
                <label htmlFor="code" className="mb-2 block text-sm font-medium text-slate-700 dark:text-white">
                  Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                    placeholder="Enter code from email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-blue-600/30 disabled:bg-blue-400 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <PumpLoadingIndicator size="sm" label="Verifying code" />
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={submitReset} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-slate-700 dark:text-white">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700 dark:text-white">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-blue-600/30 disabled:bg-blue-400 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <PumpLoadingIndicator size="sm" label="Updating password" />
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <Home className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
