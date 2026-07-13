import sqlite3
import base64
from face_verifier import verify_face_lbph

try:
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT full_name, email, face_image_path FROM users ORDER BY id DESC LIMIT 1')
    user = c.fetchone()
    print("User:", user)
    registered_img_path = user[2]

    with open(registered_img_path, 'rb') as f:
        img_bytes = f.read()

    print("Result:", verify_face_lbph(registered_img_path, img_bytes))
except Exception as e:
    import traceback
    traceback.print_exc()
