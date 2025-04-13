import * as cache from "./utils/cache.js";
import {getGraphQLClientSingleton} from "./utils/client";

/**
 * Repository search result interface
 * @interface
 */
export interface RepositorySearchResult {
    /** Total count of repositories matching the search */
    repositoryCount: number;
    /** Array of repository edges */
    edges: RepositoryEdge[];
}

/**
 * Repository edge interface
 * @interface
 */
export interface RepositoryEdge {
    /** Repository node */
    node: {
        /** Full repository name with owner (e.g., "owner/name") */
        nameWithOwner: string;
        /** Repository description */
        description: string | null;
        /** Repository URL */
        url: string;
        /** Number of stargazers */
        stargazerCount: number;
        /** Number of forks */
        forkCount: number;
        /** Primary language information */
        primaryLanguage: {
            /** Language name */
            name: string;
        } | null;
        /** Last updated timestamp */
        updatedAt: string;
    };
}

/**
 * GraphQL query response interface
 * @interface
 */
export interface RepositorySearchResponse {
    /** Search result */
    search: RepositorySearchResult;
}

/**
 * Search for GitHub repositories matching a query
 *
 * Uses the GitHub GraphQL API to search for repositories based on the provided query.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} query - Search query for repositories (GitHub search syntax)
 * @param {number} [limit=10] - Maximum number of repositories to return (1-100)
 * @returns {Promise<RepositorySearchResponse>} Repository search results
 * @throws {Error} If the API request fails
 *
 * @example
 * // Search for React state management libraries
 * const results = await searchRepositories("react state management", 5);
 * console.log(`Found ${results.search.repositoryCount} repositories`);
 * // Process each repository
 * results.search.edges.forEach(edge => {
 *   console.log(`${edge.node.nameWithOwner}: ${edge.node.description}`);
 * });
 */
export async function searchRepositories(
    query: string,
    limit = 10
): Promise<RepositorySearchResponse> {
    // Sanitize inputs
    const sanitizedLimit = Math.min(Math.max(1, limit), 100);

    // Generate cache key
    const cacheKey = `repo-search:${query}:${sanitizedLimit}`;

    // Check cache first
    const cachedResult = cache.get<RepositorySearchResponse>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // Get GraphQL client
        const graphqlWithAuth = getGraphQLClientSingleton();

        // Execute query
        const result = await graphqlWithAuth<RepositorySearchResponse>(`
      query searchRepositories($query: String!, $limit: Int!) {
        search(query: $query, type: REPOSITORY, first: $limit) {
          repositoryCount
          edges {
            node {
              ... on Repository {
                nameWithOwner
                description
                url
                stargazerCount
                forkCount
                primaryLanguage {
                  name
                }
                updatedAt
              }
            }
          }
        }
      }
    `, {
            query,
            limit: sanitizedLimit
        });

        // Save to cache
        cache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error("Error searching repositories:", error);
        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}
