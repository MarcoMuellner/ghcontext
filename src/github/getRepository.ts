import { getGraphQLClientSingleton } from "./utils/client.js";
import * as cache from "./utils/cache.js";
import {GraphQLError, GraphQLResponse} from "./utils/errors.js";

/**
 * Language edge interface
 * @interface
 */
export interface LanguageEdge {
    /** Language node */
    node: {
        /** Language name */
        name: string;
    };
    /** Size of code in this language (bytes) */
    size: number;
}

/**
 * Repository information interface
 * @interface
 */
export interface Repository {
    /** Full repository name with owner (e.g., "owner/name") */
    nameWithOwner: string;
    /** Repository description */
    description: string | null;
    /** Repository URL */
    url: string;
    /** Homepage URL */
    homepageUrl: string | null;
    /** Number of stargazers */
    stargazerCount: number;
    /** Number of forks */
    forkCount: number;
    /** Whether the repository is archived */
    isArchived: boolean;
    /** Whether the repository is a template */
    isTemplate: boolean;
    /** Primary language information */
    primaryLanguage: {
        /** Language name */
        name: string;
    } | null;
    /** Repository languages */
    languages: {
        /** Language edges */
        edges: LanguageEdge[];
    };
    /** Default branch reference */
    defaultBranchRef: {
        /** Branch name */
        name: string;
    } | null;
    /** License information */
    licenseInfo: {
        /** License name */
        name: string;
        /** SPDX license identifier */
        spdxId: string;
    } | null;
    /** Last updated timestamp */
    updatedAt: string;
}

/**
 * GraphQL repository query response
 * @interface
 */
export interface RepositoryResponse {
    /** Repository information */
    repository: Repository;
}

/**
 * Get detailed information about a specific GitHub repository
 *
 * Uses the GitHub GraphQL API to fetch comprehensive information about a repository.
 * Results are cached to improve performance and reduce API load.
 *
 * @param {string} owner - Repository owner (username or organization)
 * @param {string} name - Repository name
 * @returns {Promise<RepositoryResponse>} Repository information
 * @throws {Error} If the repository doesn't exist or the API request fails
 *
 * @example
 * // Get information about the React repository
 * const repoInfo = await getRepository("facebook", "react");
 * console.log(`Stars: ${repoInfo.repository.stargazerCount}`);
 * console.log(`Default branch: ${repoInfo.repository.defaultBranchRef.name}`);
 * // Get the top languages
 * repoInfo.repository.languages.edges.forEach(edge => {
 *   console.log(`${edge.node.name}: ${edge.size} bytes`);
 * });
 */
export async function getRepository(
    owner: string,
    name: string
): Promise<RepositoryResponse> {
    // Generate cache key
    const cacheKey = `repo:${owner}/${name}`;

    // Check cache first
    const cachedResult = cache.get<RepositoryResponse>(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    try {
        // Get GraphQL client
        const graphqlWithAuth = getGraphQLClientSingleton();

        // Execute query
        const result = await graphqlWithAuth<RepositoryResponse>(`
      query getRepository($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          nameWithOwner
          description
          url
          homepageUrl
          stargazerCount
          forkCount
          isArchived
          isTemplate
          primaryLanguage {
            name
          }
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              node {
                name
              }
              size
            }
          }
          defaultBranchRef {
            name
          }
          licenseInfo {
            name
            spdxId
          }
          updatedAt
        }
      }
    `, {
            owner,
            name
        });

        // Save to cache
        cache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error(`Error fetching repository ${owner}/${name}:`, error);

        // Check for specific GraphQL errors that indicate repository not found
        const gqlError = error as GraphQLResponse;
        if (gqlError.errors && gqlError.errors.some((e: GraphQLError) =>
            e.type === 'NOT_FOUND' || e.message.includes('Could not resolve')
        )) {
            throw new Error(`Repository not found: ${owner}/${name}`);
        }

        throw new Error(`GitHub API error: ${(error as Error).message}`);
    }
}
