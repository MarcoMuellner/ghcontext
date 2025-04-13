import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { getToken } from "./getToken";

/**
 * User agent string for GitHub API requests
 * @constant {string}
 */
const USER_AGENT = "GitCP/1.0.0";

/**
 * Initialize and get a GitHub GraphQL client instance
 *
 * Creates a configured GraphQL client with authentication from the token
 * and appropriate headers
 *
 * @returns {typeof graphql} Authenticated GraphQL client
 */
export function getGraphQLClient() {
    const { token } = getToken();

    return graphql.defaults({
        headers: {
            authorization: `token ${token}`,
            "user-agent": USER_AGENT
        }
    });
}

/**
 * Singleton instance of the GraphQL client
 */
let graphqlClientInstance: typeof graphql | null = null;

/**
 * Get the GraphQL client as a singleton
 *
 * @returns {typeof graphql} Authenticated GraphQL client
 */
export function getGraphQLClientSingleton() {
    if (!graphqlClientInstance) {
        graphqlClientInstance = getGraphQLClient();
    }
    return graphqlClientInstance;
}

/**
 * Initialize and get a GitHub REST API client instance
 *
 * Creates a configured REST API client with authentication and
 * appropriate headers
 *
 * @returns {Octokit} Authenticated Octokit REST client
 */
export function getRESTClient(): Octokit {
    const { token } = getToken();

    return new Octokit({
        auth: token,
        userAgent: USER_AGENT,
        timeZone: "UTC"
    });
}

/**
 * Singleton instance of the REST client
 */
let restClientInstance: Octokit | null = null;

/**
 * Get the REST client as a singleton
 *
 * @returns {Octokit} Authenticated Octokit REST client
 */
export function getRESTClientSingleton(): Octokit {
    if (!restClientInstance) {
        restClientInstance = getRESTClient();
    }
    return restClientInstance;
}

/**
 * Clear client singletons
 *
 * Useful for testing or when token changes
 *
 * @returns {void}
 */
export function clearClientCache(): void {
    graphqlClientInstance = null;
    restClientInstance = null;
}
