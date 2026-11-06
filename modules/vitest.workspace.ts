import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "contracts/vitest.config.ts",
  "common/vitest.config.ts",
  "text-analysis/vitest.config.ts",
  "image-match/vitest.config.ts",
  "repair-verification/vitest.config.ts",
  "geo-severity/vitest.config.ts",
  "clustering/vitest.config.ts",
  "priority-sla/vitest.config.ts",
  "officer-credibility/vitest.config.ts",
]);
