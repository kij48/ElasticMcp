# Elastic MCP Server

A Model Context Protocol (MCP) server that provides read-only access to Elasticsearch. This server is designed to help trace and correlate log entries across your system using correlation IDs.

## Features

- **Read-Only Operations**: All tools are designed for safe, read-only access to Elasticsearch
- **Correlation ID Search**: Primary tool for finding all related log entries by correlation ID
- **PII Masking**: Automatically redact sensitive information (CPR numbers, emails, phone numbers, etc.)
- **Custom Queries**: Support for complex Elasticsearch Query DSL queries
- **Index Management**: List indices and view their mappings
- **Document Retrieval**: Get specific documents by index and ID

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your Elasticsearch connection in `.env`:
```env
ELASTICSEARCH_NODE=https://localhost:9200
ELASTICSEARCH_API_KEY=your_api_key_here

# OR use username/password
# ELASTICSEARCH_USERNAME=elastic
# ELASTICSEARCH_PASSWORD=your_password_here

# Optional configurations
ELASTICSEARCH_INDEX_PATTERN=logs-*
CORRELATION_ID_FIELD=correlation_id
```

## Configuration

### Environment Variables

**Connection Settings:**
- `ELASTICSEARCH_NODE`: Elasticsearch endpoint URL (required)
- `ELASTICSEARCH_API_KEY`: API key for authentication (optional, use this OR username/password)
- `ELASTICSEARCH_USERNAME`: Username for basic auth (optional)
- `ELASTICSEARCH_PASSWORD`: Password for basic auth (optional)
- `ELASTICSEARCH_INDEX_PATTERN`: Default index pattern to search (default: `logs-*`)
- `CORRELATION_ID_FIELD`: Field name containing correlation IDs (default: `correlation_id`)

**PII Masking Settings:**
- `PII_MASKING_ENABLED`: Enable PII masking (default: `false`, set to `true` to enable)
- `PII_MASK_CPR`: Mask Danish CPR numbers in format XXXXXX-XXXX (default: `true` when masking enabled)
- `PII_MASK_EMAIL`: Mask email addresses (default: `true` when masking enabled)
- `PII_MASK_PHONE`: Mask phone numbers (default: `true` when masking enabled)
- `PII_MASK_CREDIT_CARD`: Mask credit card numbers (default: `true` when masking enabled)
- `PII_MASK_SSN`: Mask social security numbers (default: `true` when masking enabled)

## Usage

### Running the Server

Start the server directly:
```bash
npm start
```

Or use watch mode for development:
```bash
npm run dev
```

### Configuring with Claude Desktop

Add this configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["C:\\repos\\MCP\\ElasticMcp\\index.js"],
      "env": {
        "ELASTICSEARCH_NODE": "https://localhost:9200",
        "ELASTICSEARCH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Alternatively, if you have a `.env` file configured, you can use:

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["C:\\repos\\MCP\\ElasticMcp\\index.js"]
    }
  }
}
```

## Available Tools

### 1. search_by_correlation_id

Search for all entries related to a correlation ID. This is the primary tool for tracing requests through your system.

**Parameters:**
- `correlation_id` (required): The correlation ID to search for
- `index_pattern` (optional): Index pattern to search (defaults to configured pattern)
- `size` (optional): Maximum number of results (default: 100)
- `sort_field` (optional): Field to sort by (default: @timestamp)
- `sort_order` (optional): Sort order, "asc" or "desc" (default: asc)

**Example:**
```json
{
  "correlation_id": "abc-123-def-456",
  "index_pattern": "logs-2024-*",
  "size": 50,
  "sort_order": "asc"
}
```

### 2. get_document

Retrieve a specific document by its index and ID.

**Parameters:**
- `index` (required): The index name
- `document_id` (required): The document ID

**Example:**
```json
{
  "index": "logs-2024-01-15",
  "document_id": "abc123xyz"
}
```

### 3. custom_search

Execute a custom Elasticsearch query using Query DSL for complex searches.

**Parameters:**
- `query_dsl` (required): Elasticsearch Query DSL object
- `index_pattern` (optional): Index pattern to search
- `size` (optional): Maximum number of results (default: 100)

**Example:**
```json
{
  "index_pattern": "logs-*",
  "query_dsl": {
    "query": {
      "bool": {
        "must": [
          { "match": { "service.name": "api-gateway" }},
          { "range": { "@timestamp": { "gte": "now-1h" }}}
        ]
      }
    }
  },
  "size": 100
}
```

### 4. list_indices

List available Elasticsearch indices with their health status and document counts.

**Parameters:**
- `pattern` (optional): Index pattern to filter by (default: *)

**Example:**
```json
{
  "pattern": "logs-*"
}
```

### 5. get_index_mapping

Get the field mapping for an index to understand its structure.

**Parameters:**
- `index` (required): The index name or pattern

**Example:**
```json
{
  "index": "logs-2024-01-15"
}
```

## Use Cases

### Trace a Request Through Your System

Use the `search_by_correlation_id` tool to find all log entries related to a specific request:

```
Find all logs for correlation ID "req-abc-123"
```

This will return all log entries across all services that share this correlation ID, sorted chronologically.

### Debug Service Issues

1. Use `list_indices` to see available log indices
2. Use `custom_search` to find error logs for a specific service
3. Extract correlation IDs from errors
4. Use `search_by_correlation_id` to get the full request trace

### Analyze Request Flow

Search by correlation ID with ascending timestamp sort to see the chronological flow of a request through your microservices architecture.

## PII Masking

The server includes built-in PII (Personally Identifiable Information) masking to protect sensitive data in log entries.

### How It Works

When PII masking is enabled, the server automatically redacts sensitive information before returning results. This happens after data is retrieved from Elasticsearch but before it's sent to the client.

### Supported PII Types

1. **Danish CPR Numbers** (`PII_MASK_CPR`)
   - Pattern: XXXXXX-XXXX (6 digits, optional dash, 4 digits)
   - Masked as: `******-****`
   - Example: `123456-7890` → `******-****`

2. **Email Addresses** (`PII_MASK_EMAIL`)
   - Partially masked to preserve context
   - Example: `john.doe@example.com` → `jo***@example.com`

3. **Phone Numbers** (`PII_MASK_PHONE`)
   - Danish and international formats
   - Masked as: `** ** ** **`
   - Example: `+45 12 34 56 78` → `** ** ** **`

4. **Credit Card Numbers** (`PII_MASK_CREDIT_CARD`)
   - Masked as: `**** **** **** ****`

5. **Social Security Numbers** (`PII_MASK_SSN`)
   - US SSN format
   - Masked as: `***-**-****`

### Configuration Example

```json
{
  "mcpServers": {
    "elastic": {
      "command": "node",
      "args": ["C:\\repos\\MCP\\ElasticMcp\\index.js"],
      "env": {
        "ELASTICSEARCH_NODE": "https://your-cluster.es.cloud.com:9243",
        "ELASTICSEARCH_API_KEY": "your_api_key",
        "PII_MASKING_ENABLED": "true",
        "PII_MASK_CPR": "true",
        "PII_MASK_EMAIL": "true"
      }
    }
  }
}
```

### Selective Masking

You can enable masking globally but disable specific types:

```env
PII_MASKING_ENABLED=true
PII_MASK_CPR=true
PII_MASK_EMAIL=false    # Don't mask emails
PII_MASK_PHONE=true
```

## Security

This server implements read-only operations:
- No document creation or updates
- No index modifications
- No document deletions
- No cluster configuration changes

All operations use Elasticsearch's read APIs only (`search`, `get`, `cat.indices`, `indices.getMapping`).

### Additional Security Features

- **PII Masking**: Automatically redact sensitive personal information before returning results
- **Read-Only Role Support**: Works with Elasticsearch read-only API keys
- **No Data Modification**: All tools are strictly read-only operations

## Troubleshooting

### Connection Issues

If you see "Failed to connect to Elasticsearch":
1. Verify your `ELASTICSEARCH_NODE` is correct
2. Check your authentication credentials
3. Ensure Elasticsearch is running and accessible
4. Check firewall/network settings

### Certificate Errors

The server is configured with `rejectUnauthorized: false` for development. In production, you should:
1. Use proper SSL certificates
2. Set `rejectUnauthorized: true` in config.js
3. Provide CA certificate if needed

### No Results Found

If searches return no results:
1. Verify your index pattern matches your indices
2. Check the `CORRELATION_ID_FIELD` configuration matches your log field name
3. Use `list_indices` to verify indices exist
4. Use `get_index_mapping` to verify field names

## License

MIT
