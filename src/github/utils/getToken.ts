import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";
import yaml from "yaml";

dotenv.config();

/**
 * GitHub token source enumeration
 * @enum {string}
 */
export enum TokenSource {
  /** Token provided via command line argument */
  COMMAND_LINE = "command_line",
  /** Token retrieved from environment variable */
  ENVIRONMENT = "environment",
  /** Token retrieved from GitHub CLI configuration */
  GITHUB_CLI = "github_cli",
  /** No token source available */
  NONE = "none",
}

/**
 * Interface representing token information
 * @interface
 */
export interface TokenInfo {
  /** The GitHub authentication token */
  token: string;
  /** Source from which the token was retrieved */
  source: TokenSource;
}

/**
 * Retrieves a GitHub authentication token from various sources
 *
 * This function attempts to find a valid GitHub token from the following sources
 * in order of preference:
 * 1. Custom token passed as an argument (if provided)
 * 2. GITHUB_TOKEN environment variable
 * 3. GitHub CLI configuration (~/.config/gh/hosts.yml)
 *
 * @param {string|undefined} customToken - Optional custom token provided via command line
 * @throws {Error} If no valid token can be found from any source
 * @returns {TokenInfo} Object containing the token and its source
 */
export function getGitHubToken(customToken?: string): TokenInfo {
  // First check if a custom token was provided
  if (customToken) {
    return {
      token: customToken,
      source: TokenSource.COMMAND_LINE,
    };
  }
  // First check environment variable
  if (process.env.GITHUB_TOKEN) {
    return {
      token: process.env.GITHUB_TOKEN,
      source: TokenSource.ENVIRONMENT,
    };
  }

  // Try to get token from GitHub CLI
  try {
    const homeDir = os.homedir();
    const ghConfigPath = path.join(homeDir, ".config", "gh", "hosts.yml");

    if (fs.existsSync(ghConfigPath)) {
      const configFile = fs.readFileSync(ghConfigPath, "utf8");
      const config = yaml.parse(configFile);

      // Extract token from github.com host
      if (config && config["github.com"] && config["github.com"].oauth_token) {
        return {
          token: config["github.com"].oauth_token,
          source: TokenSource.GITHUB_CLI,
        };
      }
    }
  } catch (error) {
    console.warn("Could not read GitHub CLI token:", error);
  }

  throw new Error(
    "GitHub token not found. Please set GITHUB_TOKEN environment variable " +
      "or authenticate with GitHub CLI using 'gh auth login'.",
  );
}

/**
 * Singleton instance of the GitHub token
 * @type {TokenInfo | null}
 */
let tokenInstance: TokenInfo | null = null;

/**
 * Gets the GitHub token as a singleton
 *
 * Retrieves the token only once and caches it for subsequent calls
 *
 * @param {string|undefined} customToken - Optional custom token provided via command line
 * @returns {TokenInfo} The GitHub token information
 * @throws {Error} If no valid token can be found
 */
export function getToken(customToken?: string): TokenInfo {
  if (!tokenInstance || customToken) {
    tokenInstance = getGitHubToken(customToken);
  }
  return tokenInstance;
}

/**
 * Clears the cached token instance
 *
 * Useful for testing or when token needs to be refreshed
 *
 * @returns {void}
 */
export function clearTokenCache(): void {
  tokenInstance = null;
}
