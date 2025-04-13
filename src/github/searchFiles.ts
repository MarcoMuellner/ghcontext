import { getRESTClientSingleton } from "./utils/client.js";
import { getRepository } from "./getRepository.js";
import * as cache from "./utils/cache.js";
import {RequestError} from "./utils/errors";

/**
 * File or directory information interface
 * @interface
 */
export interface FileInfo {
    /** File or directory name */
    name: string;
    /** File or directory path */
    path: string;
    /** Type: can be 'file', 'dir', 'submodule', or 'symlink' */
    type: "file" | "dir" | "submodule" | "symlink";
    /** File size in bytes */
    size: number;
    /** HTML URL to view on GitHub */
    url: string | null;
    /** Download URL (null for directories) */
    downloadUrl: string | null;
}

/**
 * GitHub code search result item
 */
export interface CodeSearchResultItem {
    name: string;
    path: string;
    sha: string;
    url: string;
    git_url: string;
    html_url: string;
    repository: {
        name: string;
        full_name: string;
        owner: {
            login: string;
        };
    };
    score: number;
}

/**
 * GitHub code search results
 */
export interface CodeSearchResults {
    total_count: number;
    incomplete_results: boolean;
    items: CodeSearchResultItem[];
}

/**
 * Search for files in a GitHub repository
 *
 * Searches for files in a repository by path and/or query term.
 * If path is provided, lists contents of that directory.
 * If query is provided, filters results to match the query string.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} [path=""] - Directory path within repository (optional)
 * @param {string} [query=""] - Search term to filter files (optional)
 * @returns {Promise<FileInfo[]>} Array of file information objects
 * @throws {Error} If the path doesn't exist or the API request fails
 *
 * @example
 * // List all files in the repository root
 * const rootFiles = await searchFiles("facebook", "react");
 *
 * // List files in a specific directory
 * const srcFiles = await searchFiles("facebook", "react", "packages/react");
 *
 * // Search for files matching a query in a specific directory
 * const jsxFiles = await searchFiles("facebook", "react", "packages/react", "jsx");
 */
export async function searchFiles(
    owner: string,
    name: string,
    path: string = "",
    query: string = ""
): Promise<FileInfo[]> {
    // Generate cache key
    const cacheKey = `files:${owner}/${name}:${path}:${query}`;

    // Check cache first
    const cachedResult = cache.get<FileInfo[]>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // Get REST client
        const octokit = getRESTClientSingleton();

        // First get the default branch
        const repoInfo = await getRepository(owner, name);
        const defaultBranch = repoInfo.repository.defaultBranchRef?.name || "master";

        // Get content for the path
        const { data } = await octokit.repos.getContent({
            owner,
            repo: name,
            path: path || "",
            ref: defaultBranch
        });

        // Normalize the response to always be an array
        const contents = Array.isArray(data) ? data : [data];

        // Transform response to FileInfo array
        let files = contents.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            url: item.html_url,
            downloadUrl: item.download_url
        }));

        // Apply query filter if provided
        if (query) {
            const lowerQuery = query.toLowerCase();
            files = files.filter(file =>
                file.name.toLowerCase().includes(lowerQuery) ||
                file.path.toLowerCase().includes(lowerQuery)
            );
        }

        // Save to cache
        cache.set(cacheKey, files);
        return files;
    } catch (error) {
        console.error(`Error searching files in ${owner}/${name}:`, error);

        // Handle 404 error (path not found)
        if ((error as RequestError).status === 404) {
            throw new Error(`Path not found: ${path} in ${owner}/${name}`);
        }

        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}

/**
 * Search for files across the entire repository using GitHub's code search API
 *
 * Uses GitHub's code search API to find files matching a query across the entire repository.
 * This is more powerful than the simple path-based search but has different rate limits.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} query - Search term
 * @param {number} [limit=30] - Maximum number of results to return
 * @returns {Promise<any>} Search results
 * @throws {Error} If the API request fails
 *
 * @example
 * // Search for files containing "useEffect" in the React repository
 * const files = await searchRepositoryCode("facebook", "react", "useEffect");
 */
export async function searchRepositoryCode(
    owner: string,
    name: string,
    query: string,
    limit: number = 30
): Promise<CodeSearchResults> {
    // Generate cache key
    const cacheKey = `code-search:${owner}/${name}:${query}:${limit}`;

    // Check cache first
    const cachedResult = cache.get<CodeSearchResults>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // Get REST client
        const octokit = getRESTClientSingleton();

        // Build the qualified search query
        const searchQuery = `repo:${owner}/${name} ${query}`;

        // Execute search
        const { data } = await octokit.search.code({
            q: searchQuery,
            per_page: Math.min(100, limit)
        });

        // Save to cache
        cache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`Error searching code in ${owner}/${name}:`, error);
        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}
