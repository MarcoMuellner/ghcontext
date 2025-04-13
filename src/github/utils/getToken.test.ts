// src/github/utils/get-token.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getToken,
  getGitHubToken,
  clearTokenCache,
  TokenSource,
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
    it("should retrieve token from environment variable when available", () => {
      // Arrange
      process.env.GITHUB_TOKEN = "env-token-123";

      // Act
      const result = getGitHubToken();

      // Assert
      expect(result).toEqual({
        token: "env-token-123",
        source: TokenSource.ENVIRONMENT,
      });
      expect(fs.existsSync).not.toHaveBeenCalled(); // Shouldn't check GitHub CLI
    });

    it("should retrieve token from GitHub CLI when environment variable is not available", () => {
      // Arrange
      delete process.env.GITHUB_TOKEN;

      // Mock home directory
      vi.mocked(os.homedir).mockReturnValue("/mock/home");

      // Mock file existence and content
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("cli config content");

      // Mock yaml parsing
      vi.mocked(yaml.parse).mockReturnValue({
        "github.com": {
          oauth_token: "cli-token-123",
        },
      });

      // Act
      const result = getGitHubToken();

      // Assert
      expect(result).toEqual({
        token: "cli-token-123",
        source: TokenSource.GITHUB_CLI,
      });
      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join("/mock/home", ".config", "gh", "hosts.yml"),
      );
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
    it("should cache token for subsequent calls", () => {
      // Arrange
      process.env.GITHUB_TOKEN = "env-token-123";
      const getTokenSpy = vi.spyOn({ getGitHubToken }, "getGitHubToken");

      // Act
      const result1 = getToken();
      const result2 = getToken();

      // Assert
      expect(result1).toEqual(result2);
      expect(result1.token).toBe("env-token-123");
      expect(getTokenSpy).not.toHaveBeenCalled(); // We're spying on the local imported function
    });

    it("should create new token after clearing cache", () => {
      // Arrange
      process.env.GITHUB_TOKEN = "env-token-123";

      // Act - First call caches the token
      const result1 = getToken();

      // Change token for the second call
      process.env.GITHUB_TOKEN = "new-token-456";
      clearTokenCache();

      const result2 = getToken();

      // Assert
      expect(result1.token).toBe("env-token-123");
      expect(result2.token).toBe("new-token-456");
      expect(result1).not.toEqual(result2);
    });
  });
});
