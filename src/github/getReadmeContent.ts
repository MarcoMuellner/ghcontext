import { getRESTClientSingleton } from "./utils/client.js";
import * as cache from "./utils/cache.js";
import {RequestError} from "./utils/errors";

/**
 * Get the README content of a GitHub repository
 *
 * Fetches the README file content from a specified repository using GitHub's REST API.
 * The content is decoded from base64 to UTF-8 text.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @returns {Promise<string | null>} The README content as a string, or null if not found
 * @throws {Error} If the API request fails for reasons other than a missing README
 *
 * @example
 * // Get the README content for the React repository
 * const readme = await getReadmeContent("facebook", "react");
 * if (readme) {
 *   console.log(readme.substring(0, 200) + "..."); // Print first 200 chars
 * } else {
 *   console.log("No README found");
 * }
 */
export async function getReadmeContent(
    owner: string,
    name: string
): Promise<string | null> {
    // Generate cache key
    const cacheKey = `readme:${owner}/${name}`;

    // Check cache first
    const cachedResult = cache.get<string | null>(cacheKey);
    if (cachedResult !== undefined) {
        return cachedResult;
    }

    try {
        // Get REST client
        const octokit = getRESTClientSingleton();

        // Fetch README
        const { data } = await octokit.repos.getReadme({
            owner,
            repo: name,
            // We don't specify media type to get the default (base64 content)
        });

        // Decode content from base64
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Save to cache
        cache.set(cacheKey, content);
        return content;
    } catch (error) {
        // Handle 404 error (README not found) differently
        if ((error as RequestError).status === 404) {
            console.log(`README not found for ${owner}/${name}`);
            cache.set(cacheKey, null);
            return null;
        }

        // Log and rethrow other errors
        console.error(`Error fetching README for ${owner}/${name}:`, error);
        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}

/**
 * Get README content with a specific filename
 *
 * Similar to getReadmeContent but allows specifying a custom README filename
 * (e.g., "README.md", "README.txt", "docs/README.md").
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} path - Path to the README file
 * @returns {Promise<string | null>} The README content as a string, or null if not found
 * @throws {Error} If the API request fails for reasons other than a missing file
 */
export async function getReadmeContentByPath(
    owner: string,
    name: string,
    path: string
): Promise<string | null> {
    // Generate cache key
    const cacheKey = `readme-path:${owner}/${name}:${path}`;

    // Check cache first
    const cachedResult = cache.get<string | null>(cacheKey);
    if (cachedResult !== undefined) {
        return cachedResult;
    }

    try {
        // Get REST client
        const octokit = getRESTClientSingleton();

        // Fetch content by path
        const { data } = await octokit.repos.getContent({
            owner,
            repo: name,
            path,
        });

        // Ensure we got a file, not a directory
        if (Array.isArray(data) || data.type !== 'file') {
            throw new Error(`Path does not point to a file: ${path}`);
        }

        // Decode content from base64
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Save to cache
        cache.set(cacheKey, content);
        return content;
    } catch (error) {
        // Handle 404 error (file not found) differently
        if ((error as RequestError).status === 404) {
            console.log(`File not found: ${path} in ${owner}/${name}`);
            cache.set(cacheKey, null);
            return null;
        }

        // Log and rethrow other errors
        console.error(`Error fetching file ${path} from ${owner}/${name}:`, error);
        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}
