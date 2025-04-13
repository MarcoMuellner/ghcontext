// src/tools/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGitHubTools } from './index';
import { resetGitHubTestEnvironment, sampleRepoData, sampleReadmeContent } from '../github/__tests__/test-utils';

// Mock MCP server
const mockServer = {
    tool: vi.fn()
};

// Create mock functions for GitHub module in separate module scope
vi.mock('../github/index.js', () => {
    return {
        searchRepositories: vi.fn(),
        getRepository: vi.fn(),
        getReadmeContent: vi.fn(),
        extractApiDocumentation: vi.fn(),
        searchFiles: vi.fn(),
        getFileContent: vi.fn(),
        getRepositoryStructure: vi.fn(),
        searchRepositoryCode: vi.fn()
    };
});

// Import the mocked module
import * as github from '../github/index.js';

describe('MCP Tools Integration', () => {
    beforeEach(() => {
        resetGitHubTestEnvironment();

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should register all GitHub tools with the MCP server', () => {
        // Arrange & Act
        registerGitHubTools(mockServer as any);

        // Assert
        expect(mockServer.tool).toHaveBeenCalledTimes(8); // Verify all 8 tools are registered

        // Verify specific tool registrations
        expect(mockServer.tool).toHaveBeenCalledWith(
            'search-repositories',
            expect.any(String),
            expect.any(Object),
            expect.any(Function)
        );

        expect(mockServer.tool).toHaveBeenCalledWith(
            'get-repository-info',
            expect.any(String),
            expect.any(Object),
            expect.any(Function)
        );

        expect(mockServer.tool).toHaveBeenCalledWith(
            'get-repository-readme',
            expect.any(String),
            expect.any(Object),
            expect.any(Function)
        );

        expect(mockServer.tool).toHaveBeenCalledWith(
            'get-repository-api-docs',
            expect.any(String),
            expect.any(Object),
            expect.any(Function)
        );
    });

    describe('Tool: get-repository-info', () => {
        it('should return formatted repository information when successful', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-info tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-info'
            )?.[3];

            // Mock the getRepository function
            vi.mocked(github.getRepository).mockResolvedValue({
                repository: sampleRepoData
            });

            // Act
            const result = await toolHandler({ owner: 'facebook', name: 'react' });

            // Assert
            expect(github.getRepository).toHaveBeenCalledWith('facebook', 'react');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('# facebook/react');
            expect(result.content[0].text).toContain(`Stars: ${sampleRepoData.stargazerCount}`);
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-info tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-info'
            )?.[3];

            // Mock the getRepository function to throw an error
            const apiError = new Error('Repository not found');
            vi.mocked(github.getRepository).mockRejectedValue(apiError);

            // Act
            const result = await toolHandler({ owner: 'nonexistent', name: 'repo' });

            // Assert
            expect(github.getRepository).toHaveBeenCalledWith('nonexistent', 'repo');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error fetching repository information');
            expect(result.content[0].text).toContain('Repository not found');
        });
    });

    describe('Tool: get-repository-readme', () => {
        it('should return README content when available', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-readme tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-readme'
            )?.[3];

            // Mock the getReadmeContent function
            vi.mocked(github.getReadmeContent).mockResolvedValue(sampleReadmeContent);

            // Act
            const result = await toolHandler({ owner: 'facebook', name: 'react' });

            // Assert
            expect(github.getReadmeContent).toHaveBeenCalledWith('facebook', 'react');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('# README for facebook/react');
            expect(result.content[0].text).toContain(sampleReadmeContent);
        });

        it('should handle missing README', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-readme tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-readme'
            )?.[3];

            // Mock the getReadmeContent function to return null (README not found)
            vi.mocked(github.getReadmeContent).mockResolvedValue(null);

            // Act
            const result = await toolHandler({ owner: 'facebook', name: 'react' });

            // Assert
            expect(github.getReadmeContent).toHaveBeenCalledWith('facebook', 'react');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('README not found');
        });
    });

    describe('Tool: get-repository-api-docs', () => {
        it('should return API documentation when available', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-api-docs tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-api-docs'
            )?.[3];

            // Mock the extractApiDocumentation function
            const apiDocs = '## API Documentation\n\nSample API documentation';
            vi.mocked(github.extractApiDocumentation).mockResolvedValue(apiDocs);

            // Act
            const result = await toolHandler({ owner: 'facebook', name: 'react' });

            // Assert
            expect(github.extractApiDocumentation).toHaveBeenCalledWith('facebook', 'react');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('# API Documentation for facebook/react');
            expect(result.content[0].text).toContain(apiDocs);
        });

        it('should handle missing API documentation', async () => {
            // Arrange
            registerGitHubTools(mockServer as any);

            // Extract the handler function for the get-repository-api-docs tool
            const toolHandler = mockServer.tool.mock.calls.find(
                call => call[0] === 'get-repository-api-docs'
            )?.[3];

            // Mock the extractApiDocumentation function to return null (no API docs found)
            vi.mocked(github.extractApiDocumentation).mockResolvedValue(null);

            // Act
            const result = await toolHandler({ owner: 'facebook', name: 'react' });

            // Assert
            expect(github.extractApiDocumentation).toHaveBeenCalledWith('facebook', 'react');
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Could not extract API documentation');
        });
    });
});
