import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Storage {
  push(msg: any): any;
  list(): any[];
  clear(): void;
}

class MemoryStorage implements Storage {
  private messages: any[] = [];

  constructor(private maxMessages: number) {}

  push(msg: any): any {
    msg.received_at = new Date().toISOString();
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    return msg;
  }

  list(): any[] {
    return this.messages;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

class SqliteStorage implements Storage {
  private db: Database;
  private maxMessages: number;
  private insertStmt;
  private listStmt;
  private trimStmt;
  private clearStmt;

  constructor(maxMessages: number, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode=WAL");
    this.maxMessages = maxMessages;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id INTEGER NOT NULL,
        received_at TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `);

    this.insertStmt = this.db.prepare(
      "INSERT INTO messages (call_id, received_at, data) VALUES (?, ?, ?)"
    );
    this.listStmt = this.db.prepare(
      "SELECT data FROM messages ORDER BY id ASC"
    );
    this.trimStmt = this.db.prepare(
      "DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT ?)"
    );
    this.clearStmt = this.db.prepare("DELETE FROM messages");
  }

  push(msg: any): any {
    msg.received_at = new Date().toISOString();
    this.insertStmt.run(
      msg._callId || 0,
      msg.received_at,
      JSON.stringify(msg)
    );
    this.trimStmt.run(this.maxMessages);
    return msg;
  }

  list(): any[] {
    const rows = this.listStmt.all() as any[];
    return rows.map((row) => JSON.parse(row.data));
  }

  clear(): void {
    this.clearStmt.run();
  }
}

export function createStorage(opts: {
  type: "memory" | "sqlite";
  maxMessages: number;
  dbPath?: string;
}): Storage {
  if (opts.type === "sqlite") {
    return new SqliteStorage(
      opts.maxMessages,
      opts.dbPath || "data/transcription.db"
    );
  }
  return new MemoryStorage(opts.maxMessages);
}
