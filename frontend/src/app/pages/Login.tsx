import React from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { PublicThemeToggle } from "../components/PublicThemeToggle";
import { PumpLoadingIndicator } from "../components/PumpLoadingIndicator";
import { FlowBotLogo } from "../components/FlowBotLogo";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, authInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam =
    new URLSearchParams(location.search).get("redirect") || "";
  const redirectAfterLogin =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";
  const registerHref = redirectParam
    ? `/register?redirect=${encodeURIComponent(redirectParam)}`
    : "/register";

  React.useEffect(() => {
    if (authInitializing || !isAuthenticated) {
      return;
    }

    navigate(redirectAfterLogin, { replace: true });
  }, [authInitializing, isAuthenticated, navigate, redirectAfterLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(normalizedEmail, password);
      navigate(redirectAfterLogin, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900 flex items-center justify-center px-4">
      <div className="fixed right-4 top-4 z-50">
        <PublicThemeToggle />
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <FlowBotLogo className="mb-4" size="lg" showText={false} />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h1>
          <p className="text-slate-600 dark:text-slate-300">Sign in to your FlowBot account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/20">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-300" />
              <p className="text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-white"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-white"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pl-10 pr-11 text-slate-900 placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-300 dark:hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg hover:shadow-blue-600/30 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? <PumpLoadingIndicator size="sm" className="mx-auto" label="Signing in" /> : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Don't have an account?{" "}
              <Link
                to={registerHref}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Sign up
              </Link>
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              <Link
                to="/change-password"
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
