import React from 'react';
import { useMemo, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Shield,
  Save,
  CheckCircle,
  AlertCircle,
  Palette,
  Sun,
  Moon,
  Monitor,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme, type AppTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/api';

export function Settings() {
  const { user } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Profile settings
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [maintenanceReminders, setMaintenanceReminders] = useState(true);
  const [dailyReports, setDailyReports] = useState(false);

  const showSavedMessage = (message: string) => {
    setErrorMessage('');
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const showErrorMessage = (message: string) => {
    setSavedMessage('');
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showSavedMessage('Profile settings saved successfully!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMessage('');
    setErrorMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      showErrorMessage('All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      showErrorMessage('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      showErrorMessage('New password must be at least 8 characters');
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiFetch<{ message?: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      showSavedMessage('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showErrorMessage(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    showSavedMessage('Notification preferences saved successfully!');
  };

  const handleThemeChange = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    showSavedMessage('Appearance preferences saved successfully!');
  };

  const notificationChannelsEnabled = useMemo(() => Number(emailNotifications), [emailNotifications]);
  const alertTypesEnabled = useMemo(
    () => Number(criticalAlerts) + Number(maintenanceReminders) + Number(dailyReports),
    [criticalAlerts, maintenanceReminders, dailyReports],
  );
  const resolvedThemeLabel = resolvedTheme === 'dark' ? 'Dark Blue' : 'Light';
  const selectedThemeLabel =
    theme === 'system' ? `System (${resolvedThemeLabel})` : resolvedThemeLabel;
  const moduleCardClass = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-2xl text-gray-900 sm:text-3xl">Settings Workspace</h1>
          <p className="text-gray-600">Manage account modules from one dashboard grid.</p>
        </div>
        <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 md:w-auto">
          Signed in as <span className="break-all font-semibold">{user?.email || 'Unknown user'}</span>
        </div>
      </div>

      {savedMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800">{savedMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile</p>
          <p className="mt-2 text-lg text-slate-900">{name || user?.name || 'Unnamed User'}</p>
          <p className="text-sm text-slate-600">{email || user?.email || 'No email set'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Security</p>
          <p className="mt-2 text-lg text-slate-900">Password Protected</p>
          <p className="text-sm text-slate-600">Two-factor authentication not enabled</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appearance</p>
          <p className="mt-2 text-lg text-slate-900">{selectedThemeLabel}</p>
          <p className="text-sm text-slate-600">Applied immediately across the app</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
          <p className="mt-2 text-lg text-slate-900">{notificationChannelsEnabled}/1 channel on</p>
          <p className="text-sm text-slate-600">{alertTypesEnabled}/3 alert types enabled</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <div className={moduleCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <User className="h-5 w-5" />
              </div>
              <h2 className="text-xl text-gray-900">Profile Information</h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                Save Profile
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-6">
          <div className={moduleCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <Shield className="h-5 w-5" />
              </div>
              <h2 className="text-xl text-gray-900">Security</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label htmlFor="currentPassword" className="block text-sm text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">Minimum 8 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <KeyRound className="h-4 w-4" />
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>

          </div>
        </div>

        <div className="xl:col-span-12">
          <div className={moduleCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                <Palette className="h-5 w-5" />
              </div>
              <h2 className="text-xl text-gray-900">Appearance</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Choose how the interface looks. System follows your device theme automatically.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-white'
                }`}
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm">
                  <Sun className="h-5 w-5" />
                </div>
                <p className="text-gray-900">Light</p>
                <p className="mt-1 text-sm text-gray-600">Bright neutral surfaces for daylight use.</p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-white'
                }`}
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-blue-100 shadow-sm">
                  <Moon className="h-5 w-5" />
                </div>
                <p className="text-gray-900">Dark Blue</p>
                <p className="mt-1 text-sm text-gray-600">Deep blue surfaces designed for low-light use.</p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('system')}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  theme === 'system'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-white'
                }`}
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shadow-sm">
                  <Monitor className="h-5 w-5" />
                </div>
                <p className="text-gray-900">System</p>
                <p className="mt-1 text-sm text-gray-600">Match your OS preference in real time.</p>
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                Current theme:{' '}
                <span className="font-semibold text-gray-900">{selectedThemeLabel}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="xl:col-span-12">
          <div className={moduleCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-cyan-100 p-2 text-cyan-700">
                <Globe className="h-5 w-5" />
              </div>
              <h2 className="text-xl text-gray-900">Session Geolocation</h2>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="flex flex-col items-start gap-1 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-600">Latitude</span>
                <span className="text-gray-900">
                  {typeof user?.lat === 'number' ? user.lat.toFixed(6) : 'Not available'}
                </span>
              </div>
              <div className="flex flex-col items-start gap-1 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-600">Longitude</span>
                <span className="text-gray-900">
                  {typeof user?.lon === 'number' ? user.lon.toFixed(6) : 'Not available'}
                </span>
              </div>
              <div className="flex flex-col items-start gap-1 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-gray-600">Last Login IP</span>
                <span className="break-all text-gray-900">{user?.lastLoginIp || 'Not available'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-12">
          <div className={moduleCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                <Bell className="h-5 w-5" />
              </div>
              <h2 className="text-xl text-gray-900">Notifications</h2>
            </div>

            <form onSubmit={handleSaveNotifications} className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Channels</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900">Email Notifications</p>
                      <p className="text-xs text-gray-600">Receive alerts via email</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Alert Types</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criticalAlerts}
                      onChange={(e) => setCriticalAlerts(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900">Critical Alerts</p>
                      <p className="text-xs text-gray-600">High-priority system issues</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintenanceReminders}
                      onChange={(e) => setMaintenanceReminders(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900">Maintenance Reminders</p>
                      <p className="text-xs text-gray-600">Scheduled maintenance notifications</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyReports}
                      onChange={(e) => setDailyReports(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900">Daily Reports</p>
                      <p className="text-xs text-gray-600">Daily system performance summary</p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                Save Preferences
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
