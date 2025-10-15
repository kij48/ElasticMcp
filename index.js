#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createElasticsearchClient, getConfig } from './config.js';
import { maskPII } from './piiMasking.js';

const config = getConfig();
const esClient = createElasticsearchClient();

// Create MCP server instance
const server = new Server(
  {
    name: 'elastic-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Search Elasticsearch by correlation ID
 */
async function searchByCorrelationId(correlationId, indexPattern, size = 100, sortField = '@timestamp', sortOrder = 'asc') {
  try {
    const response = await esClient.search({
      index: indexPattern || config.indexPattern,
      body: {
        query: {
          term: {
            [`${config.correlationIdField}.keyword`]: correlationId
          }
        },
        size: size,
        sort: [
          { [sortField]: { order: sortOrder } }
        ]
      }
    });

    const result = {
      total: response.hits.total.value,
      hits: response.hits.hits.map(hit => ({
        index: hit._index,
        id: hit._id,
        score: hit._score,
        source: hit._source
      }))
    };

    return maskPII(result, config.piiMasking);
  } catch (error) {
    const errorDetails = error.meta?.body || error.message;
    throw new Error(`Elasticsearch search failed: ${JSON.stringify(errorDetails)}`);
  }
}

/**
 * Get a specific document by index and ID
 */
async function getDocument(index, documentId) {
  try {
    const response = await esClient.get({
      index: index,
      id: documentId
    });

    const result = {
      index: response._index,
      id: response._id,
      found: response.found,
      source: response._source
    };

    return maskPII(result, config.piiMasking);
  } catch (error) {
    if (error.meta?.statusCode === 404) {
      return {
        found: false,
        error: 'Document not found'
      };
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }
}

/**
 * Search Elasticsearch with custom query
 */
async function customSearch(indexPattern, queryDsl, size = 100) {
  try {
    const response = await esClient.search({
      index: indexPattern || config.indexPattern,
      body: {
        ...queryDsl,
        size: size
      }
    });

    const result = {
      total: response.hits.total.value,
      hits: response.hits.hits.map(hit => ({
        index: hit._index,
        id: hit._id,
        score: hit._score,
        source: hit._source
      }))
    };

    return maskPII(result, config.piiMasking);
  } catch (error) {
    const errorDetails = error.meta?.body || error.message;
    throw new Error(`Elasticsearch search failed: ${JSON.stringify(errorDetails)}`);
  }
}

/**
 * List available indices
 */
async function listIndices(pattern = '*') {
  try {
    const params = {
      format: 'json',
      h: 'index,health,status,docs.count,store.size'
    };

    // Only add index pattern if it's not the default wildcard
    if (pattern && pattern !== '*') {
      params.index = pattern;
    }

    const response = await esClient.cat.indices(params);

    return response.map(index => ({
      name: index.index,
      health: index.health,
      status: index.status,
      docsCount: index['docs.count'],
      storeSize: index['store.size']
    }));
  } catch (error) {
    throw new Error(`Failed to list indices: ${JSON.stringify(error.meta?.body || error.message)}`);
  }
}

/**
 * Get index mapping
 */
async function getIndexMapping(index) {
  try {
    const response = await esClient.indices.getMapping({
      index: index
    });

    return response;
  } catch (error) {
    throw new Error(`Failed to get index mapping: ${error.message}`);
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_by_correlation_id',
        description: `Search Elasticsearch for all entries related to a correlation ID. This is the primary tool for tracing requests across your system. Returns all documents matching the correlation ID, sorted by timestamp.`,
        inputSchema: {
          type: 'object',
          properties: {
            correlation_id: {
              type: 'string',
              description: 'The correlation ID to search for'
            },
            index_pattern: {
              type: 'string',
              description: `Index pattern to search (default: ${config.indexPattern})`
            },
            size: {
              type: 'number',
              description: 'Maximum number of results to return (default: 100)'
            },
            sort_field: {
              type: 'string',
              description: 'Field to sort by (default: @timestamp)'
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order (default: asc)'
            }
          },
          required: ['correlation_id']
        }
      },
      {
        name: 'get_document',
        description: 'Retrieve a specific document by its index and ID',
        inputSchema: {
          type: 'object',
          properties: {
            index: {
              type: 'string',
              description: 'The index name'
            },
            document_id: {
              type: 'string',
              description: 'The document ID'
            }
          },
          required: ['index', 'document_id']
        }
      },
      {
        name: 'custom_search',
        description: 'Execute a custom Elasticsearch query using Query DSL. Allows for complex searches beyond correlation ID lookup.',
        inputSchema: {
          type: 'object',
          properties: {
            index_pattern: {
              type: 'string',
              description: `Index pattern to search (default: ${config.indexPattern})`
            },
            query_dsl: {
              type: 'object',
              description: 'Elasticsearch Query DSL object (e.g., {"query": {"match": {"field": "value"}}})'
            },
            size: {
              type: 'number',
              description: 'Maximum number of results to return (default: 100)'
            }
          },
          required: ['query_dsl']
        }
      },
      {
        name: 'list_indices',
        description: 'List available Elasticsearch indices with their health status and document counts',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Index pattern to filter by (default: *)'
            }
          }
        }
      },
      {
        name: 'get_index_mapping',
        description: 'Get the field mapping for an index to understand its structure',
        inputSchema: {
          type: 'object',
          properties: {
            index: {
              type: 'string',
              description: 'The index name or pattern'
            }
          },
          required: ['index']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_by_correlation_id': {
        const result = await searchByCorrelationId(
          args.correlation_id,
          args.index_pattern,
          args.size,
          args.sort_field,
          args.sort_order
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_document': {
        const result = await getDocument(args.index, args.document_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'custom_search': {
        const result = await customSearch(
          args.index_pattern,
          args.query_dsl,
          args.size
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'list_indices': {
        const result = await listIndices(args.pattern);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_index_mapping': {
        const result = await getIndexMapping(args.index);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  // Test Elasticsearch connection with a simple search instead of ping
  // (ping requires cluster:monitor/main privilege which read-only roles don't have)
  try {
    // Try a minimal search to verify connection and permissions
    await esClient.search({
      index: config.indexPattern,
      size: 0,
      body: { query: { match_all: {} } }
    });
    console.error('Successfully connected to Elasticsearch');
  } catch (error) {
    console.error('Failed to connect to Elasticsearch:');
    console.error('Error:', error.message);
    console.error('Error Details:', JSON.stringify(error.meta?.body || error, null, 2));
    console.error('Config:', {
      node: config.node,
      hasApiKey: !!config.apiKey,
      hasUsername: !!config.username,
      indexPattern: config.indexPattern
    });
    console.error('Please check your Elasticsearch configuration');
    console.error('For Elastic Cloud, ensure your API key is in the correct format and has proper permissions');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Elastic MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
