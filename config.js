import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';

/**
 * Load configuration from environment variables or .env file
 */
function loadConfig() {
  // Try to load .env file if it exists
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }

  // Parse PII masking configuration
  const piiMaskingEnabled = process.env.PII_MASKING_ENABLED === 'true';
  const piiMaskingConfig = {
    enabled: piiMaskingEnabled,
    cpr: process.env.PII_MASK_CPR !== 'false', // Enabled by default
    email: process.env.PII_MASK_EMAIL !== 'false',
    phone: process.env.PII_MASK_PHONE !== 'false',
    creditCard: process.env.PII_MASK_CREDIT_CARD !== 'false',
    ssn: process.env.PII_MASK_SSN !== 'false'
  };

  return {
    node: process.env.ELASTICSEARCH_NODE || 'https://localhost:9200',
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indexPattern: process.env.ELASTICSEARCH_INDEX_PATTERN || 'logs-*',
    correlationIdField: process.env.CORRELATION_ID_FIELD || 'fields.CorrelationIdentifier',
    piiMasking: piiMaskingConfig
  };
}

/**
 * Create and configure Elasticsearch client
 */
export function createElasticsearchClient() {
  const config = loadConfig();

  const clientConfig = {
    node: config.node,
    tls: {
      rejectUnauthorized: false // Set to true in production with proper certificates
    }
  };

  // Use API key authentication if available
  if (config.apiKey) {
    // Try to parse as JSON first (for {id, api_key} format)
    try {
      const parsed = JSON.parse(config.apiKey);
      if (parsed.id && parsed.api_key) {
        clientConfig.auth = {
          apiKey: parsed
        };
      } else {
        clientConfig.auth = {
          apiKey: config.apiKey
        };
      }
    } catch {
      // Not JSON, use as-is (base64 encoded string)
      clientConfig.auth = {
        apiKey: config.apiKey
      };
    }
  }
  // Otherwise use username/password
  else if (config.username && config.password) {
    clientConfig.auth = {
      username: config.username,
      password: config.password
    };
  }

  return new Client(clientConfig);
}

export function getConfig() {
  return loadConfig();
}
