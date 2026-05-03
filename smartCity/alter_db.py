import sqlite3
import sys

try:
    conn = sqlite3.connect('instance/civic.db')
    cursor = conn.cursor()
    # Check if column exists first
    cursor.execute("PRAGMA table_info(complaint)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'resolution_image_url' not in columns:
        cursor.execute('ALTER TABLE complaint ADD COLUMN resolution_image_url VARCHAR(255)')
        conn.commit()
        print('Added resolution_image_url to complaint table')
    else:
        print('resolution_image_url already exists in complaint table')
        
    # Check user table for session_token
    cursor.execute("PRAGMA table_info(user)")
    user_columns = [info[1] for info in cursor.fetchall()]
    if 'session_token' not in user_columns:
        cursor.execute('ALTER TABLE user ADD COLUMN session_token VARCHAR(255)')
        conn.commit()
        print('Added session_token to user table')
    else:
        print('session_token already exists in user table')
        
    conn.close()
except Exception as e:
    print('Error altering db:', e)
    sys.exit(1)
