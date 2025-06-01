"use client";

import { Amplify } from "aws-amplify";
import { ReactNode, useEffect } from "react";

// Configuration Amplify côté client
let isConfigured = false;

interface AmplifyProviderProps {
  children: ReactNode;
}

export default function AmplifyProvider({ children }: AmplifyProviderProps) {
  useEffect(() => {
    if (!isConfigured) {
      try {
        const outputs = require("../../../amplify_outputs.json");
        Amplify.configure(outputs);
        isConfigured = true;
        console.log("✅ Amplify configuré avec succès");
      } catch (error) {
        console.warn("⚠️ Amplify configuration not found, running in dev mode without backend");
      }
    }
  }, []);

  // Pas d'authentification forcée pour le moment
  return <>{children}</>;
}
