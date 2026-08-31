import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  // Use root base for local dev, and the subfolder base for production build
  base: process.env.NODE_ENV === 'production' ? "/DWD/Ai-Nano/exams/" : "/",
  build: { outDir: "exams" },
});
