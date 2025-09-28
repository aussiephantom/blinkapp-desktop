import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';

export interface ProcessingQueueItem {
  id: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  tags: string;
  folderPath?: string;
  entityId?: number;
  transactionId?: number;
  stageKey?: string;
  notes?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileHistoryItem {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  tags: string;
  folderPath?: string;
  entityId?: number;
  transactionId?: number;
  stageKey?: string;
  notes?: string;
  processedAt: string;
}

export interface CachedData {
  key: string;
  value: string;
  expiresAt: string;
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    // Use temp directory for database
    this.dbPath = path.join(os.tmpdir(), 'blinkapp-desktop.db');
    console.log('[DATABASE] Database path:', this.dbPath);
  }

  async initialize(): Promise<void> {
    try {
      console.log('[DATABASE] Initializing database...');
      
      // Try to create database
      this.db = new Database(this.dbPath);
      
      // Create tables
      this.createTables();
      
      console.log('[DATABASE] Database initialized successfully');
    } catch (error) {
      console.error('[DATABASE] Error initializing database:', error);
      
      // Fallback to mock database
      console.log('[DATABASE] Falling back to mock database mode');
      this.db = null;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    try {
      // Processing queue table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS processing_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          tags TEXT,
          folder_path TEXT,
          entity_id INTEGER,
          transaction_id INTEGER,
          stage_key TEXT,
          notes TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // File history table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS file_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          tags TEXT,
          folder_path TEXT,
          entity_id INTEGER,
          transaction_id INTEGER,
          stage_key TEXT,
          notes TEXT,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Cache table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at DATETIME NOT NULL
        )
      `);

      console.log('[DATABASE] Tables created successfully');
    } catch (error) {
      console.error('[DATABASE] Error creating tables:', error);
    }
  }

  // Processing Queue Methods
  addToProcessingQueue(item: Omit<ProcessingQueueItem, 'id' | 'createdAt' | 'updatedAt'>): number {
    if (!this.db) {
      console.log('[DATABASE] Mock: Adding to processing queue');
      return Date.now(); // Mock ID
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO processing_queue 
        (file_path, file_name, file_size, status, tags, folder_path, entity_id, transaction_id, stage_key, notes, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        item.filePath,
        item.fileName,
        item.fileSize,
        item.status,
        item.tags,
        item.folderPath || null,
        item.entityId || null,
        item.transactionId || null,
        item.stageKey || null,
        item.notes || null,
        item.errorMessage || null
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('[DATABASE] Error adding to processing queue:', error);
      return 0;
    }
  }

  getProcessingQueue(): ProcessingQueueItem[] {
    if (!this.db) {
      console.log('[DATABASE] Mock: Getting processing queue');
      return [];
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM processing_queue ORDER BY created_at DESC');
      return stmt.all() as ProcessingQueueItem[];
    } catch (error) {
      console.error('[DATABASE] Error getting processing queue:', error);
      return [];
    }
  }

  updateProcessingStatus(id: number, status: string, errorMessage?: string): boolean {
    if (!this.db) {
      console.log('[DATABASE] Mock: Updating processing status');
      return true;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE processing_queue 
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);

      stmt.run(status, errorMessage || null, id);
      return true;
    } catch (error) {
      console.error('[DATABASE] Error updating processing status:', error);
      return false;
    }
  }

  removeFromProcessingQueue(id: number): boolean {
    if (!this.db) {
      console.log('[DATABASE] Mock: Removing from processing queue');
      return true;
    }

    try {
      const stmt = this.db.prepare('DELETE FROM processing_queue WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      console.error('[DATABASE] Error removing from processing queue:', error);
      return false;
    }
  }

  // File History Methods
  addToFileHistory(item: Omit<FileHistoryItem, 'id' | 'processedAt'>): number {
    if (!this.db) {
      console.log('[DATABASE] Mock: Adding to file history');
      return Date.now(); // Mock ID
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO file_history 
        (file_name, file_path, file_size, tags, folder_path, entity_id, transaction_id, stage_key, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        item.fileName,
        item.filePath,
        item.fileSize,
        item.tags,
        item.folderPath || null,
        item.entityId || null,
        item.transactionId || null,
        item.stageKey || null,
        item.notes || null
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('[DATABASE] Error adding to file history:', error);
      return 0;
    }
  }

  getFileHistory(limit: number = 50): FileHistoryItem[] {
    if (!this.db) {
      console.log('[DATABASE] Mock: Getting file history');
      return [];
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM file_history ORDER BY processed_at DESC LIMIT ?');
      return stmt.all(limit) as FileHistoryItem[];
    } catch (error) {
      console.error('[DATABASE] Error getting file history:', error);
      return [];
    }
  }

  // Cache Methods
  cacheData(key: string, value: any, ttlMinutes: number = 60): boolean {
    if (!this.db) {
      console.log('[DATABASE] Mock: Caching data');
      return true;
    }

    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache (key, value, expires_at) 
        VALUES (?, ?, ?)
      `);

      stmt.run(key, JSON.stringify(value), expiresAt);
      return true;
    } catch (error) {
      console.error('[DATABASE] Error caching data:', error);
      return false;
    }
  }

  getCachedData(key: string): any | null {
    if (!this.db) {
      console.log('[DATABASE] Mock: Getting cached data');
      return null;
    }

    try {
      const stmt = this.db.prepare('SELECT value, expires_at FROM cache WHERE key = ?');
      const result = stmt.get(key) as any;

      if (!result) {
        return null;
      }

      // Check if expired
      if (new Date(result.expires_at) < new Date()) {
        // Remove expired entry
        const deleteStmt = this.db.prepare('DELETE FROM cache WHERE key = ?');
        deleteStmt.run(key);
        return null;
      }

      return JSON.parse(result.value);
    } catch (error) {
      console.error('[DATABASE] Error getting cached data:', error);
      return null;
    }
  }

  clearExpiredCache(): void {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare('DELETE FROM cache WHERE expires_at < CURRENT_TIMESTAMP');
      stmt.run();
    } catch (error) {
      console.error('[DATABASE] Error clearing expired cache:', error);
    }
  }

  // Cleanup
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
