import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import App from "./app/App";
import { LoginPage } from "./features/login/LoginPage";
import { AuthProvider } from "./shared/auth/AuthProvider";
import { ProtectedRoute } from "./shared/auth/ProtectedRoute";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<App />} />
            <Route path="/materiales" element={<App />} />
            <Route path="*" element={<App />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
