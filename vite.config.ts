import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";

// agents() must come first: it adds the TC39 decorator transform that
// @callable() needs (Vite 8's Oxc transpiler does not do decorators yet).
export default defineConfig({
  plugins: [agents(), react(), cloudflare()],
});
