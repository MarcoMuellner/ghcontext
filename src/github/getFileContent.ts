import { getRESTClientSingleton } from "./utils/client.js";
import * as cache from "./utils/cache.js";
import { RequestError } from "./utils/errors";

/**
 * Get the content of a specific file from a GitHub repository
 *
 * Fetches a file's content from the repository using GitHub's REST API.
 * The content is decoded from base64 to UTF-8 text.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} path - File path within the repository
 * @param {string} [ref] - Git reference (branch, tag, or commit SHA). Defaults to the repository's default branch.
 * @returns {Promise<string>} The file content as a string
 * @throws {Error} If the file doesn't exist, isn't a file, or the API request fails
 *
 * @example
 * // Get the content of package.json
 * const content = await getFileContent("facebook", "react", "package.json");
 * const packageJson = JSON.parse(content);
 * console.log(`React version: ${packageJson.version}`);
 *
 * // Get content from a specific branch
 * const readme = await getFileContent("facebook", "react", "README.md", "experimental");
 */
export async function getFileContent(
  owner: string,
  name: string,
  path: string,
  ref?: string,
): Promise<string> {
  // Generate cache key (include ref if provided)
  const cacheKey = ref
    ? `file:${owner}/${name}:${path}:${ref}`
    : `file:${owner}/${name}:${path}`;

  // Check cache first
  const cachedResult = cache.get<string>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    // Get REST client
    const octokit = getRESTClientSingleton();

    // Fetch file content
    const { data } = await octokit.repos.getContent({
      owner,
      repo: name,
      path,
      ref,
    });

    // Ensure we got a file, not a directory
    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`Path does not point to a file: ${path}`);
    }

    // Decode content from base64
    const content = Buffer.from(data.content, "base64").toString("utf-8");

    // Save to cache
    cache.set(cacheKey, content);
    return content;
  } catch (error) {
    console.error(`Error fetching file ${path} from ${owner}/${name}:`, error);

    // Handle 404 error (file not found)
    if ((error as RequestError).status === 404) {
      throw new Error(`File not found: ${path} in ${owner}/${name}`);
    }

    throw new Error(`GitHub API error: ${(error as Error).message}`);
  }
}

/**
 * Get raw content of a file from GitHub
 *
 * Uses the raw content URL to fetch file data directly. This is useful for:
 * - Binary files that shouldn't be decoded from base64
 * - Very large files that might exceed GitHub API limits
 * - Fetching content without authentication (public repositories only)
 *
 * Note: This doesn't use the GitHub API but directly fetches from raw.githubusercontent.com
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} path - File path within the repository
 * @param {string} [ref="main"] - Git reference (branch, tag, or commit SHA)
 * @returns {Promise<Buffer>} The file content as a Buffer
 * @throws {Error} If the file doesn't exist or the request fails
 *
 * @example
 * // Get an image file as a buffer
 * const imageBuffer = await getRawFileContent("user", "repo", "assets/logo.png");
 * // Get raw content from a specific commit
 * const oldCode = await getRawFileContent("user", "repo", "src/index.js", "abc123");
 */
export async function getRawFileContent(
  owner: string,
  name: string,
  path: string,
  ref: string = "main",
): Promise<Buffer> {
  // Generate cache key
  const cacheKey = `raw-file:${owner}/${name}:${path}:${ref}`;

  // Check cache first (but only if it's small enough)
  const cachedResult = cache.get<Buffer>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    // Construct raw content URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${ref}/${path}`;

    // Fetch raw content
    const response = await fetch(rawUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Get content as buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Only cache if file is smaller than 1MB
    if (buffer.length < 1024 * 1024) {
      cache.set(cacheKey, buffer);
    }

    return buffer;
  } catch (error) {
    console.error(
      `Error fetching raw file ${path} from ${owner}/${name}:`,
      error,
    );
    throw new Error(`Failed to fetch raw file: ${(error as Error).message}`);
  }
}
