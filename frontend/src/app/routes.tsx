import React from 'react';
import { createBrowserRouter } from "react-router";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { PumpList } from "./pages/PumpList";
import { RegisterPump } from "./pages/RegisterPump";
import { PumpDetails } from "./pages/PumpDetails";
import { PurchasePump } from "./pages/PurchasePump";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Alerts } from "./pages/Alerts";
import { Settings } from "./pages/Settings";
import { Control } from "./pages/Control";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { NotFound } from "./pages/NotFound";
import { EmailVerification } from "./pages/EmailVerification";
import { ChangePassword } from "./pages/ChangePassword";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/verify-email",
    Component: EmailVerification,
  },
  {
    path: "/change-password",
    Component: ChangePassword,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        path: "dashboard",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
      },
      {
        path: "pumps",
        element: <ProtectedRoute><PumpList /></ProtectedRoute>,
      },
      {
        path: "register-pump",
        element: <ProtectedRoute><RegisterPump /></ProtectedRoute>,
      },
      {
        path: "pumps/:id",
        element: <ProtectedRoute><PumpDetails /></ProtectedRoute>,
      },
      {
        path: "pumps/:id/purchase",
        element: <ProtectedRoute><PurchasePump /></ProtectedRoute>,
      },
      {
        path: "admin",
        element: <AdminRoute><AdminDashboard /></AdminRoute>,
      },
      {
        path: "alerts",
        element: <ProtectedRoute><Alerts /></ProtectedRoute>,
      },
      {
        path: "settings",
        element: <ProtectedRoute><Settings /></ProtectedRoute>,
      },
      {
        path: "control",
        element: <ProtectedRoute><Control /></ProtectedRoute>,
      },
    ],
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
