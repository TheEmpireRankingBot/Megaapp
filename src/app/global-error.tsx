"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0a", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.55 }}>Megaapp</p>
            <h1 style={{ margin: "12px 0 0", fontSize: 24 }}>We couldn’t load the app</h1>
            <p style={{ margin: "10px 0 20px", fontSize: 14, lineHeight: 1.6, opacity: 0.65 }}>
              Your saved data has not been changed. Retry the app, and use the reference below if the problem continues.
            </p>
            {error.digest && <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.4 }}>Reference {error.digest}</p>}
            <button type="button" onClick={reset} style={{ border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
              Retry Megaapp
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
