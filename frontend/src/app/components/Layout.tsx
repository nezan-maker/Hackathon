import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard,
  Droplets,
  AlertTriangle,
  Settings,
  LogOut,
  PlusCircle,
  ShieldCheck,
  SlidersHorizontal,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export function Layout() {
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDarkTheme = resolvedTheme === "dark";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pumps", href: "/pumps", icon: Droplets },
    {
      name: "Register Purchased Pump",
      href: "/register-pump",
      icon: PlusCircle,
    },
    {
      name: "Control",
      href: "/control",
      icon: SlidersHorizontal,
    },
    ...(user?.role === "admin"
      ? [{ name: "Admin", href: "/admin", icon: ShieldCheck }]
      : []),
    { name: "Alerts", href: "/alerts", icon: AlertTriangle },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar - Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div
          className={`flex min-h-0 flex-1 flex-col shadow-xl ${
            isDarkTheme
              ? "bg-gradient-to-b from-slate-900 to-slate-800"
              : "bg-white border-r border-slate-200 shadow-slate-200/80"
          }`}
        >
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4 mb-8">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <span
                className={`ml-3 text-xl font-semibold ${isDarkTheme ? "text-white" : "text-slate-900"}`}
              >
                FlowBot
              </span>
            </div>
            <nav className="mt-2 flex-1 space-y-1 px-3">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.href)
                        ? isDarkTheme
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                        : isDarkTheme
                          ? "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div
            className={`flex flex-shrink-0 p-4 ${isDarkTheme ? "border-t border-slate-700" : "border-t border-slate-200"}`}
          >
            <div className="flex items-center w-full">
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${isDarkTheme ? "text-white" : "text-slate-900"}`}
                >
                  {user?.name}
                </p>
                <p
                  className={`text-xs truncate ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}
                >
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className={`ml-3 p-2 rounded-lg transition-all ${
                  isDarkTheme
                    ? "text-slate-400 hover:text-white hover:bg-slate-700"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 shadow-lg z-50 ${
          isDarkTheme
            ? "bg-gradient-to-r from-slate-900 to-slate-800"
            : "bg-white border-b border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <span
              className={`ml-2 text-lg font-semibold ${isDarkTheme ? "text-white" : "text-slate-900"}`}
            >
              FlowBot
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg transition-all ${
              isDarkTheme
                ? "text-white hover:bg-slate-700"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className={
              isDarkTheme
                ? "bg-slate-900 border-t border-slate-700"
                : "bg-white border-t border-slate-200"
            }
          >
            <nav className="px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center px-3 py-3 rounded-lg transition-all ${
                      isActive(item.href)
                        ? isDarkTheme
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                        : isDarkTheme
                          ? "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div
              className={`p-4 ${isDarkTheme ? "border-t border-slate-700" : "border-t border-slate-200"}`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium truncate ${isDarkTheme ? "text-white" : "text-slate-900"}`}
                  >
                    {user?.name}
                  </p>
                  <p
                    className={`text-xs truncate ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className={`ml-3 p-2 rounded-lg transition-all ${
                    isDarkTheme
                      ? "text-slate-400 hover:text-white hover:bg-slate-700"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1 pt-16 md:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
