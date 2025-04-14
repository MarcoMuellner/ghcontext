// src/github/utils/get-token.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getToken,
  getGitHubToken,
  clearTokenCache,
  TokenSource, setToken,
} from "./getToken";
import fs from "fs";
import path from "path";
import os from "os";
import yaml from "yaml";
import { resetGitHubTestEnvironment } from "../__tests__/test-utils";

// Mock filesystem operations
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

// Mock os for home directory
vi.mock("os", () => ({
  default: {
    homedir: vi.fn(),
  },
}));

// Mock yaml parser
vi.mock("yaml", () => ({
  default: {
    parse: vi.fn(),
  },
}));

describe("GitHub Token Utilities", () => {
  beforeEach(() => {
    resetGitHubTestEnvironment();
    vi.resetAllMocks();
    clearTokenCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getGitHubToken", () => {
    it("should use provided custom token when available", () => {
      // Arrange
      process.env.GITHUB_TOKEN = "env-token-123";
      const customToken = "cli-argument-token";

      // Act
      const result = getGitHubToken(customToken);

      // Assert
      expect(result).toEqual({
        token: customToken,
        source: TokenSource.COMMAND_LINE,
      });
      expect(fs.existsSync).not.toHaveBeenCalled(); // Shouldn't check other sources
    });

    it("should throw error when no token is available", () => {
      // Arrange
      delete process.env.GITHUB_TOKEN;
      vi.mocked(os.homedir).mockReturnValue("/mock/home");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("cli config content");

      // Mock invalid yaml content
      vi.mocked(yaml.parse).mockReturnValue({});

      // Act & Assert
      expect(() => getGitHubToken()).toThrow("GitHub token not found");
    });

    it("should handle GitHub CLI config file not existing", () => {
      // Arrange
      delete process.env.GITHUB_TOKEN;
      vi.mocked(os.homedir).mockReturnValue("/mock/home");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Act & Assert
      expect(() => getGitHubToken()).toThrow("GitHub token not found");
    });
  });

  describe("getToken", () => {
    it("should use custom token when provided even if cache exists", () => {
      // Arrange
      setToken("env-token-123");

      // First call with no custom token (uses env var)
      const result1 = getToken();

      // Second call with custom token (should override cache)
      const customToken = "custom-cli-token";
      const result2 = getToken(customToken);

      // Assert
      expect(result1.token).toBe("env-token-123");
      expect(result1.source).toBe(TokenSource.COMMAND_LINE);

      expect(result2.token).toBe(customToken);
      expect(result2.source).toBe(TokenSource.COMMAND_LINE);
      expect(result1).not.toEqual(result2);
    });
  });
});
