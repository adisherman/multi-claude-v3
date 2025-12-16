/**
 * PostgreSQL Database Client
 * Provides connection pool and query interface for Multi-Claude 3.0 database
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database configuration
 * Supports both DATABASE_URL (connection string) and individual config variables
 */
const dbConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20, // Maximum pool connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'multi_claude_system',
      user: process.env.DB_USER || process.env.USER,
      password: process.env.DB_PASSWORD || '',
      max: 20, // Maximum pool connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

/**
 * Database Client class
 */
export class DatabaseClient {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool(dbConfig);
    this.setupEventListeners();
  }

  /**
   * Set up pool event listeners
   */
  private setupEventListeners(): void {
    if (!this.pool) return;

    this.pool.on('connect', () => {
      this.isConnected = true;
      console.log('✓ Database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      console.log('Client removed from pool');
    });
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool!.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✓ Database connected successfully at', result.rows[0].now);
    } catch (error) {
      this.isConnected = false;
      console.error('✗ Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      // Log slow queries (> 1000ms)
      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error: any) {
      console.error('Query error:', error.message);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.connect();
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      connected: this.isConnected,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('✓ Database connections closed');
    }
  }
}

// Export singleton instance
export const db = new DatabaseClient();
