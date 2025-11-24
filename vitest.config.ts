import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      GITHUB_TOKEN: "test-github-token",
      OPENAI_API_KEY: "test-openai-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "docs/**",
        "**/*.config.{js,ts}",
        "**/*.test.{js,ts}",
        ".github/**",
      ],
    },
  },
});
