// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
var __electron_vite_injected_dirname = "C:\\Users\\AntoteLintelo\\ClaudeProjects\\Auto-Caude\\apps\\frontend";
dotenvConfig({ path: resolve(__electron_vite_injected_dirname, ".env") });
var sentryDefines = {
  "__SENTRY_DSN__": JSON.stringify(process.env.SENTRY_DSN || ""),
  "__SENTRY_TRACES_SAMPLE_RATE__": JSON.stringify(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
  "__SENTRY_PROFILES_SAMPLE_RATE__": JSON.stringify(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1")
};
var electron_vite_config_default = defineConfig({
  main: {
    define: sentryDefines,
    resolve: {
      alias: {
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared")
      }
    },
    plugins: [externalizeDepsPlugin({
      // Bundle these packages into the main process (they won't be in node_modules in packaged app)
      exclude: [
        "uuid",
        "chokidar",
        "dotenv",
        "electron-log",
        "proper-lockfile",
        "semver",
        "zod",
        "@anthropic-ai/sdk",
        "kuzu",
        "electron-updater",
        "@electron-toolkit/utils",
        // Sentry and its transitive dependencies (opentelemetry -> debug -> ms)
        "@sentry/electron",
        "@sentry/core",
        "@sentry/node",
        "@sentry/utils",
        "@opentelemetry/instrumentation",
        "debug",
        "ms",
        // Minimatch for glob pattern matching in worktree handlers
        "minimatch",
        // XState for task state machine
        "xstate"
      ]
    })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        },
        // Only node-pty needs to be external (native module rebuilt by electron-builder)
        external: ["@lydell/node-pty"]
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared")
      }
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts")
        }
      }
    }
  },
  renderer: {
    define: sentryDefines,
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html")
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__electron_vite_injected_dirname, "src/renderer"),
        "@shared": resolve(__electron_vite_injected_dirname, "src/shared"),
        "@features": resolve(__electron_vite_injected_dirname, "src/renderer/features"),
        "@components": resolve(__electron_vite_injected_dirname, "src/renderer/shared/components"),
        "@hooks": resolve(__electron_vite_injected_dirname, "src/renderer/shared/hooks"),
        "@lib": resolve(__electron_vite_injected_dirname, "src/renderer/shared/lib")
      }
    },
    server: {
      watch: {
        // Ignore directories to prevent HMR conflicts during merge operations
        // Using absolute paths and broader patterns
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.worktrees/**",
          "**/.juict-agentic-os/**",
          "**/out/**",
          // Ignore the parent autonomous-coding directory's worktrees
          resolve(__electron_vite_injected_dirname, "../.worktrees/**"),
          resolve(__electron_vite_injected_dirname, "../.juict-agentic-os/**")
        ]
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
