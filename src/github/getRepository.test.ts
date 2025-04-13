// src/github/getRepository.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRepository } from './getRepository';
import { resetGitHubTestEnvironment, sampleRepoData } from './__tests__/test-utils';
import * as cache from './utils/cache';
import fetchMock from 'fetch-mock';

// Mock the GraphQL client
vi.mock('./utils/client.js', () => {
    // Create a function to be used for mocking graphql requests
    const mockGraphqlFn = vi.fn();
    return {
        getGraphQLClientSingleton: () => mockGraphqlFn,
    };
});

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

describe('getRepository', () => {
    // GraphQL client mock
    let mockGraphqlFn: any;

    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();

        // Get reference to the mocked graphql function
        mockGraphqlFn = require('./utils/client.js').getGraphQLClientSingleton();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return cached repository data if available', async () => {
        // Arrange
        const expectedData = { repository: { ...sampleRepoData } };
        vi.mocked(cache.get).mockReturnValue(expectedData);

        // Act
        const result = await getRepository('facebook', 'react');

        // Assert
        expect(cache.get).toHaveBeenCalledWith('repo:facebook/react');
        expect(mockGraphqlFn).not.toHaveBeenCalled(); // GraphQL not called when cache hit
        expect(result).toEqual(expectedData);
    });

    it('should fetch repository data from GitHub API when not cached', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        const expectedData = { repository: { ...sampleRepoData } };
        mockGraphqlFn.mockResolvedValue(expectedData);

        // Act
        const result = await getRepository('facebook', 'react');

        // Assert
        expect(cache.get).toHaveBeenCalledWith('repo:facebook/react');
        expect(mockGraphqlFn).toHaveBeenCalledWith(
            expect.stringContaining('query getRepository'),
            { owner: 'facebook', name: 'react' }
        );
        expect(cache.set).toHaveBeenCalledWith('repo:facebook/react', expectedData);
        expect(result).toEqual(expectedData);
    });

    it('should throw error when repository is not found', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        const graphqlError = {
            errors: [{ type: 'NOT_FOUND', message: 'Could not resolve repository' }]
        };
        mockGraphqlFn.mockRejectedValue(graphqlError);

        // Act & Assert
        await expect(getRepository('nonexistent', 'repo')).rejects.toThrow('Repository not found');
        expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
    });

    it('should throw error for other GraphQL errors', async () => {
        // Arrange
        vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
        const graphqlError = new Error('Rate limit exceeded');
        mockGraphqlFn.mockRejectedValue(graphqlError);

        // Act & Assert
        await expect(getRepository('facebook', 'react')).rejects.toThrow('GitHub API error');
        expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
    });
});
