import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PumpPromiseLoader } from './components/PumpPromiseLoader';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <PumpPromiseLoader />
      </AuthProvider>
    </ThemeProvider>
  );
}
