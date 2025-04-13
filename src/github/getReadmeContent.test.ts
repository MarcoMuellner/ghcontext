// src/github/getReadmeContent.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReadmeContent, getReadmeContentByPath } from './getReadmeContent';
import { resetGitHubTestEnvironment, sampleReadmeContent } from './__tests__/test-utils';
import * as cache from './utils/cache';

// Sample base64 encoded content
const base64Content = Buffer.from(sampleReadmeContent).toString('base64');

// Create a mock REST client
const mockRestClient = {
    repos: {
        getReadme: vi.fn(),
        getContent: vi.fn()
    }
};

// Mock the REST client
vi.mock('./utils/client.js', () => ({
    getRESTClientSingleton: () => mockRestClient
}), { virtual: true });

// Mock the cache
vi.mock('./utils/cache.js', () => ({
    get: vi.fn(),
    set: vi.fn(),
}), { virtual: true });

describe('README Content Retrieval', () => {
    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getReadmeContent', () => {
        it('should return cached README content if available', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(sampleReadmeContent);

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme:facebook/react');
            expect(mockRestClient.repos.getReadme).not.toHaveBeenCalled();
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should fetch README content from GitHub API when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getReadme.mockResolvedValue({
                data: {
                    content: base64Content
                }
            });

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme:facebook/react');
            expect(mockRestClient.repos.getReadme).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react'
            });
            expect(cache.set).toHaveBeenCalledWith('readme:facebook/react', sampleReadmeContent);
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should return null when README is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = {
                status: 404,
                message: 'Not Found'
            };
            mockRestClient.repos.getReadme.mockRejectedValue(notFoundError);

            // Act
            const result = await getReadmeContent('facebook', 'react');

            // Assert
            expect(result).toBeNull();
            // Don't check cache.set - we now cache null results
        });

        it('should throw error for other API errors', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const apiError = new Error('API rate limit exceeded');
            mockRestClient.repos.getReadme.mockRejectedValue(apiError);

            // Act & Assert
            await expect(getReadmeContent('facebook', 'react')).rejects.toThrow('GitHub API error');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });
    });

    describe('getReadmeContentByPath', () => {
        it('should return cached README content if available', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(sampleReadmeContent);

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', 'docs/README.md');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md');
            expect(mockRestClient.repos.getContent).not.toHaveBeenCalled();
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should fetch README content by path from GitHub API when not cached', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    type: 'file',
                    content: base64Content
                }
            });

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', 'docs/README.md');

            // Assert
            expect(cache.get).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md');
            expect(mockRestClient.repos.getContent).toHaveBeenCalledWith({
                owner: 'facebook',
                repo: 'react',
                path: 'docs/README.md'
            });
            expect(cache.set).toHaveBeenCalledWith('readme-path:facebook/react:docs/README.md', sampleReadmeContent);
            expect(result).toEqual(sampleReadmeContent);
        });

        it('should throw error when path points to a directory, not a file', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            mockRestClient.repos.getContent.mockResolvedValue({
                data: {
                    type: 'dir',
                    name: 'docs'
                }
            });

            // Act & Assert
            await expect(getReadmeContentByPath('facebook', 'react', 'docs')).rejects.toThrow('Path does not point to a file');
            expect(cache.set).not.toHaveBeenCalled(); // Don't cache errors
        });

        it('should return null when README path is not found', async () => {
            // Arrange
            vi.mocked(cache.get).mockReturnValue(undefined); // Cache miss
            const notFoundError = {
                status: 404,
                message: 'Not Found'
            };
            mockRestClient.repos.getContent.mockRejectedValue(notFoundError);

            // Act
            const result = await getReadmeContentByPath('facebook', 'react', 'nonexistent/README.md');

            // Assert
            expect(result).toBeNull();
            // Don't check cache.set - we now cache null results
        });
    });
});