import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path";

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:4000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
      "@utils": resolve(projectRoot, "utils")
    }
  },
  build: {
    // 🔒 Nenhum source map exposto no navegador do usuário
    sourcemap: false,
    minify: 'esbuild',
  },
  esbuild: {
    // 🧹 Remove todos os console.* e debugger em produção
    drop: ['console', 'debugger'],
  },
  server: {
    port: 5000,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true
      },
      "/uploads": {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  },
  preview: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true
      },
      "/uploads": {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  }
});
