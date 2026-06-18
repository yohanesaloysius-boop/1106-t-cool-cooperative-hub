import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Security headers diterapkan ke setiap response server (SSR + server fn).
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  // Catatan: jangan pakai X-Frame-Options SAMEORIGIN karena memblokir preview
  // di editor Lovable (origin berbeda). Pakai CSP frame-ancestors yang
  // mengizinkan domain Lovable + self, tetap melindungi dari clickjacking.
  setResponseHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev",
  );
  setResponseHeader("X-Content-Type-Options", "nosniff");
  setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  setResponseHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
