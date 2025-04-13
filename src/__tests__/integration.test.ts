// src/__tests__/integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGitHubTools } from '../tools';
import { resetGitHubTestEnvironment, setupTestEnv, sampleRepoData, sampleReadmeContent } from '../github/__tests__/test-utils';

// Create a transport mock for testing
class MockTransport {
    sentMessages: any[] = [];

    async send(message: any) {
        this.sentMessages.push(message);
    }

    async onConnect(_listener: any) {
        // No-op for testing
    }

    async onMessage(_listener: any) {
        // No-op for testing
    }

    async onClose(_listener: any) {
        // No-op for testing
    }

    async close() {
        // No-op for testing
    }

    mockReceiveMessage(message: any) {
        // Helper to simulate receiving a message from the client
        const server = this._server as any;
        if (server && server._messageListener) {
            server._messageListener(message);
        }
    }

    _server: any = null;
}

// Mock GitHub modules
vi.mock('../github/index.js', () => ({
    getToken: vi.fn().mockReturnValue({ token: 'test-token', source: 'environment' }),
    searchRepositories: vi.fn(),
    getRepository: vi.fn(),
    getReadmeContent: vi.fn(),
    extractApiDocumentation: vi.fn(),
    searchFiles: vi.fn(),
    getFileContent: vi.fn(),
    getRepositoryStructure: vi.fn(),
    searchRepositoryCode: vi.fn()
}));

describe('MCP Server Integration', () => {
    let server: McpServer;
    let transport: MockTransport;

    beforeEach(() => {
        resetGitHubTestEnvironment();
        setupTestEnv();

        // Reset mocks
        vi.clearAllMocks();

        // Create a new MCP server and transport for each test
        server = new McpServer({
            name: 'GitCP-Test',
            version: '1.0.0',
            description: 'GitHub Context Provider for LLMs (Test)',
            capabilities: {
                resources: {},
                tools: {},
            },
        });

        transport = new MockTransport();

        // Register GitHub tools
        registerGitHubTools(server);
    });

    afterEach(async () => {
        vi.clearAllMocks();
    });

    describe('Tool Registration and Discovery', () => {
        it('should register all GitHub tools and list them in capabilities', async () => {
            // Arrange & Act
            await server.connect(transport as any);
            transport._server = server;

            // Simulate a client requesting capabilities
            transport.mockReceiveMessage({
                kind: 'capabilities',
                id: 'test-1',
            });

            // Assert
            expect(transport.sentMessages.length).toBeGreaterThan(0);

            const capabilitiesResponse = transport.sentMessages.find(
                (msg) => msg.kind === 'capabilities' && msg.id === 'test-1'
            );

            expect(capabilitiesResponse).toBeDefined();
            expect(capabilitiesResponse.body.tools).toBeDefined();

            // Check for presence of specific tools
            const toolNames = Object.keys(capabilitiesResponse.body.tools);
            expect(toolNames).toContain('search-repositories');
            expect(toolNames).toContain('get-repository-info');
            expect(toolNames).toContain('get-repository-readme');
            expect(toolNames).toContain('get-repository-api-docs');
        });
    });

    describe('Tool Execution', () => {
        it('should handle the get-repository-info tool request', async () => {
            // Arrange
            await server.connect(transport as any);
            transport._server = server;

            // Mock GitHub API response
            const github = require('../github/index.js');
            github.getRepository.mockResolvedValue({
                repository: sampleRepoData
            });

            // Simulate a tool request
            transport.mockReceiveMessage({
                kind: 'tool-call',
                id: 'tool-1',
                body: {
                    name: 'get-repository-info',
                    parameters: {
                        owner: 'facebook',
                        name: 'react'
                    }
                }
            });

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            expect(github.getRepository).toHaveBeenCalledWith('facebook', 'react');

            const toolResponse = transport.sentMessages.find(
                (msg) => msg.kind === 'tool-result' && msg.id === 'tool-1'
            );

            expect(toolResponse).toBeDefined();
            expect(toolResponse.body.status).toBe('success');
            expect(toolResponse.body.result.content[0].type).toBe('text');
            expect(toolResponse.body.result.content[0].text).toContain('facebook/react');
        });

        it('should handle the get-repository-readme tool request', async () => {
            // Arrange
            await server.connect(transport as any);
            transport._server = server;

            // Mock GitHub API response
            const github = require('../github/index.js');
            github.getReadmeContent.mockResolvedValue(sampleReadmeContent);

            // Simulate a tool request
            transport.mockReceiveMessage({
                kind: 'tool-call',
                id: 'tool-2',
                body: {
                    name: 'get-repository-readme',
                    parameters: {
                        owner: 'facebook',
                        name: 'react'
                    }
                }
            });

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            expect(github.getReadmeContent).toHaveBeenCalledWith('facebook', 'react');

            const toolResponse = transport.sentMessages.find(
                (msg) => msg.kind === 'tool-result' && msg.id === 'tool-2'
            );

            expect(toolResponse).toBeDefined();
            expect(toolResponse.body.status).toBe('success');
            expect(toolResponse.body.result.content[0].type).toBe('text');
            expect(toolResponse.body.result.content[0].text).toContain('README for facebook/react');
            expect(toolResponse.body.result.content[0].text).toContain(sampleReadmeContent);
        });

        it('should handle errors during tool execution', async () => {
            // Arrange
            await server.connect(transport as any);
            transport._server = server;

            // Mock GitHub API error
            const github = require('../github/index.js');
            github.getRepository.mockRejectedValue(new Error('API rate limit exceeded'));

            // Simulate a tool request
            transport.mockReceiveMessage({
                kind: 'tool-call',
                id: 'tool-3',
                body: {
                    name: 'get-repository-info',
                    parameters: {
                        owner: 'facebook',
                        name: 'react'
                    }
                }
            });

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            const toolResponse = transport.sentMessages.find(
                (msg) => msg.kind === 'tool-result' && msg.id === 'tool-3'
            );

            expect(toolResponse).toBeDefined();
            expect(toolResponse.body.status).toBe('success'); // Tool execution still succeeds with error handling
            expect(toolResponse.body.result.content[0].text).toContain('Error fetching repository information');
            expect(toolResponse.body.result.content[0].text).toContain('API rate limit exceeded');
        });

        it('should validate tool parameters', async () => {
            // Arrange
            await server.connect(transport as any);
            transport._server = server;

            // Simulate a tool request with missing required parameters
            transport.mockReceiveMessage({
                kind: 'tool-call',
                id: 'tool-4',
                body: {
                    name: 'get-repository-info',
                    parameters: {
                        // Missing required 'name' parameter
                        owner: 'facebook'
                    }
                }
            });

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            const toolResponse = transport.sentMessages.find(
                (msg) => msg.kind === 'tool-result' && msg.id === 'tool-4'
            );

            expect(toolResponse).toBeDefined();
            expect(toolResponse.body.status).toBe('error');
            expect(toolResponse.body.error).toContain('Required');
        });
    });
});
