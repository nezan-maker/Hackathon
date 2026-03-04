import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import { CheckCircle2, AlertTriangle, MailCheck, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PublicThemeToggle } from '../components/PublicThemeToggle';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

export function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [code, setCode] = useState('');
  const redirectParam = new URLSearchParams(location.search).get('redirect') || '';
  const redirectAfterVerification =
    redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard';

  useEffect(() => {
    if (status === 'success') {
      const timeout = setTimeout(() => {
        navigate(redirectAfterVerification);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [status, navigate, redirectAfterVerification]);

  const isLoading = status === 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!code.trim()) {
      setStatus('error');
      setMessage('Please enter the verification code sent to your email.');
      return;
    }

    setStatus('loading');

    try {
      await verifyEmail(code.trim());
      setStatus('success');
      setMessage('Your email has been successfully verified.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Email verification failed.');
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
            <MailCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Email Verification</h1>
          <p className="text-slate-600 dark:text-slate-300">We&apos;re confirming your email address</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-slate-600 dark:text-slate-200">
                Enter the 8-digit verification code we sent to your email to activate your account.
              </p>

              <div>
                <label htmlFor="code" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Verification Code
                </label>
                <div className="relative">
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-lg tracking-[0.4em] text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {status === 'error' && message && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/20">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500 dark:text-red-200" />
                  <p className="text-sm text-red-700 dark:text-red-100">{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-blue-600/30 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <PumpLoadingIndicator size="sm" label="Verifying email" />
                ) : (
                  <span>Verify Email</span>
                )}
              </button>
            </form>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-emerald-700 dark:text-emerald-200">{message}</p>
              <p className="text-slate-600 dark:text-slate-300">
                Your email has been verified. Taking you to your destination...
              </p>
              <Link
                to={redirectAfterVerification}
                className="mt-4 inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-blue-600/30"
              >
                Continue
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-red-400" />
              <p className="font-medium text-red-700 dark:text-red-200">Email verification failed</p>
              <p className="text-slate-700 dark:text-slate-200">{message}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                If your link has expired, request a new verification email from the login or
                settings page.
              </p>
            </div>
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

