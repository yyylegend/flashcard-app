"""
SQLite → PostgreSQL 数据迁移脚本
用法：python migrate_sqlite_to_pg.py
"""
import sqlite3
import psycopg2
import psycopg2.extras
import os
import sys

SQLITE_PATH = os.environ.get("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "../backend/flashcards.db"))

PG_HOST = os.environ.get("PG_HOST", "localhost")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_DB   = os.environ.get("PG_DB", "flashcards")
PG_USER = os.environ.get("PG_USER", "postgres")
PG_PASS = os.environ.get("PG_PASSWORD", "postgres")

def get_sqlite():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_pg():
    return psycopg2.connect(
        host=PG_HOST, port=PG_PORT,
        dbname=PG_DB, user=PG_USER, password=PG_PASS
    )

def migrate():
    print("连接 SQLite...")
    sqlite = get_sqlite()

    print("连接 PostgreSQL...")
    pg = get_pg()
    cur = pg.cursor()

    # ── 迁移 decks ──
    print("\n迁移题库 (decks)...")
    rows = sqlite.execute("SELECT id, name, created_at FROM decks").fetchall()
    for r in rows:
        cur.execute(
            "INSERT INTO decks (id, name, created_at) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (r["id"], r["name"], r["created_at"])
        )
    # 更新序列，避免后续插入 id 冲突
    cur.execute("SELECT setval('decks_id_seq', (SELECT MAX(id) FROM decks))")
    print(f"  → {len(rows)} 条题库")

    # ── 迁移 cards ──
    print("迁移卡片 (cards)...")
    rows = sqlite.execute("SELECT id, deck_id, category, question, answer, tips, created_at FROM cards").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO cards (id, deck_id, category, question, answer, tips, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            (r["id"], r["deck_id"], r["category"], r["question"], r["answer"], r["tips"], r["created_at"])
        )
    print(f"  → {len(rows)} 条卡片")

    # ── 迁移 users ──
    print("迁移用户 (users)...")
    rows = sqlite.execute("SELECT username, password_hash FROM users").fetchall()
    for r in rows:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s) ON CONFLICT (username) DO NOTHING",
            (r["username"], r["password_hash"])
        )
    print(f"  → {len(rows)} 个用户")

    # ── 迁移 notes ──
    print("迁移笔记 (notes)...")
    rows = sqlite.execute("SELECT id, title, content, tags, uploaded_by, created_at, updated_at FROM notes").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO notes (id, title, content, tags, uploaded_by, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO NOTHING""",
            (r["id"], r["title"], r["content"], r["tags"], r["uploaded_by"], r["created_at"], r["updated_at"])
        )
    cur.execute("SELECT setval('notes_id_seq', GREATEST((SELECT MAX(id) FROM notes), 1))")
    print(f"  → {len(rows)} 条笔记")

    pg.commit()
    cur.close()
    sqlite.close()
    pg.close()
    print("\n✅ 迁移完成！")

if __name__ == "__main__":
    migrate()
