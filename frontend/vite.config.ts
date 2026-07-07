// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    // Use the Vercel preset so `vite build` (called by vercel-build) outputs
    // to `.vercel/output` — the directory Vercel expects. When NITRO_PRESET
    // is set in the Vercel environment this is auto-detected, but hard-pinning
    // here guarantees correctness in all cases.
    preset: "vercel",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // react-is is a CJS-only package (no `module`/`exports` field) that recharts
    // imports via an ES static import inside its ESM build. Rollup cannot resolve
    // bare CJS packages on its own, so we tell Vite/esbuild to pre-bundle it
    // (CJS → ESM conversion) for the client build, and mark it noExternal so the
    // SSR/Nitro build bundles it too instead of leaving a bare require().
    optimizeDeps: {
      include: ["react-is"],
    },
    ssr: {
      noExternal: ["react-is"],
    },
    server: {
      proxy: {
        // Proxy API calls to the FastAPI backend during local dev
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
        "/health": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  },
});

