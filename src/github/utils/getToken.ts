// No imports needed for just handling command-line tokens

/**
 * GitHub token source enumeration
 * @enum {string}
 */
export enum TokenSource {
  /** Token provided via command line argument */
  COMMAND_LINE = "command_line",
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
 * Retrieves a GitHub authentication token
 *
 * This function accepts a GitHub token provided via command line
 *
 * @param {string|undefined} customToken - Required token provided via command line
 * @throws {Error} If no token is provided
 * @returns {TokenInfo} Object containing the token and its source
 */
export function getGitHubToken(customToken?: string): TokenInfo {
  // Check if a custom token was provided
  if (customToken) {
    return {
      token: customToken,
      source: TokenSource.COMMAND_LINE,
    };
  }

  if (tokenInstance) {
    return tokenInstance;
  }

  throw new Error(
    "GitHub token not found. Please provide a token with --GITHUB_TOKEN option."
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
 * @param {string} customToken - Required token provided via command line
 * @returns {TokenInfo} The GitHub token information
 * @throws {Error} If no token is provided
 */
export function getToken(customToken?: string): TokenInfo {
  if (!tokenInstance || customToken) {
    tokenInstance = getGitHubToken(customToken);
  }
  return tokenInstance;
}

export function setToken(customToken: string): TokenInfo {
    tokenInstance = {
      token: customToken,
      source: TokenSource.COMMAND_LINE,
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
