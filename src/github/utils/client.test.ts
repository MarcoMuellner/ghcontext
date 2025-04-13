// src/github/utils/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGraphQLClient, getRESTClient, getGraphQLClientSingleton, getRESTClientSingleton, clearClientCache } from './client.js';
import { graphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';
import { resetGitHubTestEnvironment, setupTestEnv } from '../__tests__/test-utils.js';

// Mock the getToken module
vi.mock('./getToken.js', () => ({
    getToken: () => ({ token: 'mock-token-123', source: 'environment' })
}));

// Mock the external libraries
vi.mock('@octokit/graphql', () => ({
    graphql: {
        defaults: vi.fn().mockReturnValue('mocked-graphql-client')
    }
}));

vi.mock('@octokit/rest', () => ({
    Octokit: vi.fn().mockImplementation(() => ({
        repos: {},
        git: {},
        search: {}
    }))
}));

describe('GitHub Client Utilities', () => {
    beforeEach(() => {
        resetGitHubTestEnvironment();
        setupTestEnv();
        clearClientCache(); // Reset singletons before each test
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getGraphQLClient', () => {
        it('should create a GraphQL client with correct configuration', () => {
            // Arrange & Act
            const client = getGraphQLClient();

            // Assert
            expect(graphql.defaults).toHaveBeenCalledWith({
                headers: {
                    authorization: 'token mock-token-123',
                    'user-agent': expect.stringContaining('GitCP/')
                }
            });
            expect(client).toBe('mocked-graphql-client');
        });
    });

    describe('getRESTClient', () => {
        it('should create a REST client with correct configuration', () => {
            // Arrange & Act
            getRESTClient();

            // Assert
            expect(Octokit).toHaveBeenCalledWith({
                auth: 'mock-token-123',
                userAgent: expect.stringContaining('GitCP/'),
                timeZone: 'UTC'
            });
        });
    });

    describe('Singleton behavior', () => {
        it('should return the same GraphQL client instance for multiple calls', () => {
            // Arrange
            const spy = vi.spyOn(graphql, 'defaults');

            // Act
            const client1 = getGraphQLClientSingleton();
            const client2 = getGraphQLClientSingleton();

            // Assert
            expect(spy).toHaveBeenCalledTimes(1); // Called only once
            expect(client1).toBe(client2); // Same instance
        });

        it('should return the same REST client instance for multiple calls', () => {
            // Arrange

            // Act
            const client1 = getRESTClientSingleton();
            const client2 = getRESTClientSingleton();

            // Assert
            expect(Octokit).toHaveBeenCalledTimes(1); // Constructor called only once
            expect(client1).toBe(client2); // Same instance
        });

        it('should create new instances after clearing cache', () => {
            // Arrange - Mock the client creation functions to return new objects each time
            vi.mocked(graphql.defaults)
                .mockReturnValueOnce('first-graphql-client')
                .mockReturnValueOnce('second-graphql-client');
                
            vi.mocked(Octokit)
                .mockImplementationOnce(() => ({ id: 'first-rest-client' } as any))
                .mockImplementationOnce(() => ({ id: 'second-rest-client' } as any));
                
            // Get initial clients
            const client1 = getGraphQLClientSingleton();
            const restClient1 = getRESTClientSingleton();

            // Act - Clear cache and get new clients
            clearClientCache();
            const client2 = getGraphQLClientSingleton();
            const restClient2 = getRESTClientSingleton();

            // Assert
            expect(graphql.defaults).toHaveBeenCalledTimes(2); // Called twice
            expect(Octokit).toHaveBeenCalledTimes(2); // Constructor called twice
            expect(client1).not.toEqual(client2); // Different instances
            expect(restClient1).not.toEqual(restClient2); // Different instances
        });
    });
});
