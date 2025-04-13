import { getRESTClientSingleton } from "./utils/client.js";
import { getRepository } from "./getRepository.js";
import * as cache from "./utils/cache.js";
import {RequestError} from "./utils/errors";

/**
 * File entry in repository structure
 * @interface
 */
export interface StructureFile {
    /** File name */
    name: string;
    /** Full file path */
    path: string;
    /** Entry type: 'file' */
    type: 'file';
    /** File size in bytes */
    size: number;
}

/**
 * Directory entry in repository structure
 * @interface
 */
export interface StructureDirectory {
    /** Directory name */
    name: string;
    /** Full directory path */
    path: string;
    /** Entry type: 'dir' */
    type: 'dir';
    /** Nested files and directories */
    contents: (StructureFile | StructureDirectory)[];
}

/** Repository structure entry (file or directory) */
export type StructureEntry = StructureFile | StructureDirectory;

/**
 * Get the directory structure of a GitHub repository
 *
 * Recursively traverses the repository structure starting from the given path.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} [path=""] - Directory path within repository (optional)
 * @param {number} [maxDepth=3] - Maximum recursion depth (to avoid API rate limits)
 * @returns {Promise<StructureEntry>} Repository structure tree
 * @throws {Error} If the path doesn't exist or the API request fails
 *
 * @example
 * // Get the entire repository structure (limited to depth 3)
 * const structure = await getRepositoryStructure("facebook", "react");
 *
 * // Get structure of a specific directory with increased depth
 * const srcStructure = await getRepositoryStructure("facebook", "react", "packages", 5);
 */
export async function getRepositoryStructure(
    owner: string,
    name: string,
    path: string = "",
    maxDepth: number = 3
): Promise<StructureEntry> {
    // Generate cache key
    const cacheKey = `structure:${owner}/${name}:${path}:${maxDepth}`;

    // Check cache first
    const cachedResult = cache.get<StructureEntry>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // Get REST client
        const octokit = getRESTClientSingleton();

        // First get repo info to get default branch
        const repoInfo = await getRepository(owner, name);
        const defaultBranch = repoInfo.repository.defaultBranchRef?.name || "master";

        /**
         * Recursively get the structure of a directory
         * @param currentPath - The path to get the structure for
         * @param depth - Current recursion depth
         * @returns The structure of the directory
         */
        async function getStructure(currentPath: string, depth: number = 0): Promise<StructureEntry> {
            const { data } = await octokit.repos.getContent({
                owner,
                repo: name,
                path: currentPath,
                ref: defaultBranch
            });

            // If data is not an array, it's a file
            if (!Array.isArray(data)) {
                return {
                    name: data.name,
                    path: data.path,
                    type: 'file',
                    size: data.size
                };
            }

            // If data is an array, it's a directory
            const contents: StructureEntry[] = [];

            // Stop recursion if we've reached the max depth
            if (depth < maxDepth) {
                for (const item of data) {
                    if (item.type === 'dir') {
                        // For directories, recursively get their structure
                        const subStructure = await getStructure(item.path, depth + 1);
                        contents.push(subStructure);
                    } else {
                        // For files, just add them to the result
                        contents.push({
                            name: item.name,
                            path: item.path,
                            type: 'file',
                            size: item.size
                        });
                    }
                }
            } else {
                // At max depth, just add placeholders for directories
                for (const item of data) {
                    if (item.type === 'dir') {
                        contents.push({
                            name: item.name,
                            path: item.path,
                            type: 'dir',
                            contents: [] // Empty at max depth
                        });
                    } else {
                        contents.push({
                            name: item.name,
                            path: item.path,
                            type: 'file',
                            size: item.size
                        });
                    }
                }
            }

            return {
                name: currentPath.split('/').pop() || name,
                path: currentPath || '/',
                type: 'dir',
                contents
            };
        }

        // Get the structure starting from the given path
        const structure = await getStructure(path);

        // Save to cache
        cache.set(cacheKey, structure);
        return structure;
    } catch (error) {
        console.error(`Error fetching structure for ${owner}/${name}:`, error);

        // Handle 404 error (path not found)
        if ((error as RequestError).status === 404) {
            throw new Error(`Path not found: ${path} in ${owner}/${name}`);
        }

        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}

/**
 * Get a simplified flat list of files in a repository
 *
 * Unlike getRepositoryStructure, this returns a flat list of files instead of a tree.
 * Useful when you just need a list of all files without caring about the directory structure.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @param {string} [extension] - Optional file extension filter (e.g., "js", "ts")
 * @returns {Promise<string[]>} List of file paths
 * @throws {Error} If the API request fails
 *
 * @example
 * // Get all JavaScript files in a repository
 * const jsFiles = await getRepositoryFiles("facebook", "react", "js");
 */
export async function getRepositoryFiles(
    owner: string,
    name: string,
    extension?: string
): Promise<string[]> {
    // Generate cache key
    const cacheKey = `repo-files:${owner}/${name}:${extension || 'all'}`;

    // Check cache first
    const cachedResult = cache.get<string[]>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // First get the default branch
        const repoInfo = await getRepository(owner, name);
        const defaultBranch = repoInfo.repository.defaultBranchRef?.name || "master";

        // Get REST client
        const octokit = getRESTClientSingleton();

        // We need to use the Git Trees API to get all files efficiently
        const { data } = await octokit.git.getTree({
            owner,
            repo: name,
            tree_sha: defaultBranch,
            recursive: '1' // Get all files in the tree recursively
        });

        // Filter for files only and optionally by extension
        let files = (data.tree || [])
            .filter(item => item.type === 'blob' && item.path)
            .map(item => item.path as string);

        // Apply extension filter if provided
        if (extension) {
            const ext = extension.startsWith('.') ? extension : `.${extension}`;
            files = files.filter(file => file.endsWith(ext));
        }

        // Save to cache
        cache.set(cacheKey, files);
        return files;
    } catch (error) {
        console.error(`Error fetching files for ${owner}/${name}:`, error);
        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}
