import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

@Injectable({
  providedIn: 'root',
})
export class SqliteService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;

  async initDB() {
    const db = await this.sqlite.createConnection(
      'students_db',
      false,
      'no-encryption',
      1,
      false
    );
    await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY,
        name TEXT,
        image TEXT
      );
    `);
    this.db = db;
    console.log('✅ SQLite DB initialized');
  }

  async saveStudent(name: string, imageBase64: string) {
    const stmt = `INSERT INTO students (name, image) VALUES (?, ?)`;
    await this.db.run(stmt, [name, imageBase64]);
    console.log(`✅ Saved ${name} to SQLite`);
  }

  async getAllStudents(): Promise<{ name: string; image: string }[]> {
    const result = await this.db.query('SELECT name, image FROM students');
    return result.values ?? [];
  }
}
