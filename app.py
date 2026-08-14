from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import base64
import os
import uuid
import datetime
import random
import numpy as np
import cv2
import requests
from pyzbar.pyzbar import decode

import pandas as pd

app = Flask(__name__)
app.secret_key = 'smart_checkout_super_secret_key' # Needed for session management

UPLOAD_FOLDER = 'uploads/faces'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def init_db():
    conn = sqlite3.connect('database.db', timeout=10)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            face_image_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS fraud_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Products table for Smart Checkout
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE,
            name TEXT,
            price REAL,
            image_url TEXT
        )
    ''')
    
    # Seed dummy products (Matching the image provided)
    products = [
        ('8901058014235', 'Maggi Masala Noodles', 10.00, 'maggi.png')
    ]
    
    for product in products:
        try:
            c.execute('INSERT INTO products (barcode, name, price, image_url) VALUES (?, ?, ?, ?)', product)
        except sqlite3.IntegrityError:
            pass # Already exists
            
    conn.commit()
    conn.close()

init_db()

@app.route('/')
@app.route('/dashboard')
def dashboard():

    conn = sqlite3.connect('database.db', timeout=10)
    c = conn.cursor()
    c.execute('SELECT id, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5')
    recent_txs = c.fetchall()
    conn.close()
    
    return render_template('dashboard.html', recent_txs=recent_txs)

@app.route('/scan')
def scan():
    return render_template('scan.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/logout')
def logout():
    return redirect(url_for('dashboard'))

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    full_name = data.get('fullName')
    email = data.get('email')
    password = data.get('password')
    image_data = data.get('faceImage')
    
    if not all([full_name, email, password, image_data]):
        return jsonify({'success': False, 'message': 'Missing data'}), 400
        
    try:
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        img_bytes = base64.b64decode(image_data)
        filename = f"{uuid.uuid4().hex}_{datetime.datetime.now().strftime('%Y%M%d%H%M%S')}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(filepath, 'wb') as f:
            f.write(img_bytes)
            
        conn = sqlite3.connect('database.db', timeout=10)
        c = conn.cursor()
        c.execute('INSERT INTO users (full_name, email, password, face_image_path) VALUES (?, ?, ?, ?)',
                  (full_name, email, password, filepath))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Registration and Face saved successfully!'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Email already exists!'}), 400
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/api/scan_barcode', methods=['POST'])
def scan_barcode():
    data = request.json
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({'success': False, 'message': 'No image provided'}), 400
        
    try:
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        img_bytes = base64.b64decode(image_data)
        
        # Convert bytes to numpy array for OpenCV
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale for better detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Decode barcode using pyzbar
        barcodes = decode(gray)
        barcode_val = None
        
        if barcodes:
            barcode_val = barcodes[0].data.decode('utf-8')
        else:
            # Try to enhance the image for pyzbar
            # Apply GaussianBlur to reduce noise and improve edge detection
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
            barcodes_thresh = decode(thresh)
            
            if barcodes_thresh:
                barcode_val = barcodes_thresh[0].data.decode('utf-8')
            else:
                # Try OpenCV's built-in BarcodeDetector as a final fallback (if available)
                try:
                    bd = cv2.barcode_BarcodeDetector() if hasattr(cv2, 'barcode_BarcodeDetector') else None
                    if bd:
                        retval, decoded_info, decoded_type, points = bd.detectAndDecode(img)
                        if retval and decoded_info and decoded_info[0]:
                            barcode_val = decoded_info[0]
                except Exception:
                    pass
                
        if not barcode_val:
            return jsonify({'success': False, 'message': 'No barcode detected. Please try again.'})
        
        try:
            name = "Unknown Product"
            image = "https://via.placeholder.com/150/1e293b/22c55e?text=Product"
            price = 0.0
            found = False

            try:
                # Load CSV and treat barcode as string to prevent leading zero drops or precision issues
                df = pd.read_csv('dataset.csv', dtype={'barcode': str})
                
                # Search for the barcode
                product_row = df[df['barcode'] == str(barcode_val)]
                
                if not product_row.empty:
                    # Extract values from the first matched row
                    row_data = product_row.iloc[0]
                    name = row_data['name']
                    price = float(row_data['price'])
                    if 'image_url' in row_data and pd.notna(row_data['image_url']):
                        image = row_data['image_url']
                    found = True
            except Exception as csv_e:
                print(f"CSV Read Error: {str(csv_e)}")

            if not found:
                return jsonify({'success': False, 'message': f'Barcode {barcode_val} database mein nahi mila. Kripya naya product scan karein.'})

            # Format price properly
            price = round(float(price), 2)
                
            return jsonify({
                'success': True, 
                'product': {
                    'barcode': barcode_val,
                    'name': name,
                    'price': price,
                    'image': image
                }
            })
                
        except Exception as api_e:
            print(f"API Error: {str(api_e)}")
            return jsonify({'success': False, 'message': 'Internal API Error'}), 500
            
    except Exception as e:
        print(f"Error scanning: {str(e)}")
        return jsonify({'success': False, 'message': 'Error processing barcode'}), 500

@app.route('/receipt')
def receipt():
    return render_template('receipt.html')

@app.route('/admin_login', methods=['POST'])
def admin_login():
    username = request.form.get('username')
    password = request.form.get('password')
    if username == 'admin' and password == 'admin123':
        session['admin_logged_in'] = True
    return redirect(url_for('admin'))

@app.route('/admin_logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin'))

@app.route('/admin')
def admin():
    if not session.get('admin_logged_in'):
        return render_template('admin.html', logged_in=False)
        
    conn = sqlite3.connect('database.db', timeout=10)
    c = conn.cursor()
    
    # Total Sales and Transactions
    c.execute('SELECT COUNT(*), SUM(amount) FROM transactions')
    tx_count, sales_amount = c.fetchone()
    
    # Fraud count
    c.execute('SELECT COUNT(*) FROM fraud_attempts')
    fraud_count = c.fetchone()[0]
    
    # Total Customers
    c.execute('SELECT COUNT(*) FROM users')
    customers = c.fetchone()[0]
    
    # Recent Transactions
    c.execute('SELECT id, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5')
    recent_txs = c.fetchall()
    
    conn.close()
    
    return render_template('admin.html', 
                           logged_in=True,
                           sales=sales_amount or 0.0, 
                           tx_count=tx_count or 0,
                           fraud=fraud_count or 0,
                           customers=customers or 0,
                           recent_txs=recent_txs)

@app.route('/api/verify_face', methods=['POST'])
def verify_face():
    data = request.json
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({'success': False, 'message': 'No image provided'}), 400
        
    try:
        # Get the latest registered user
        conn = sqlite3.connect('database.db', timeout=10)
        c = conn.cursor()
        c.execute('SELECT full_name, email, face_image_path FROM users ORDER BY id DESC LIMIT 1')
        user = c.fetchone()
        conn.close()

        if not user:
            return jsonify({'success': False, 'message': 'No registered user found in DB'}), 400
            
        full_name, email, registered_img_path = user
        # Lightweight OpenCV Face Comparison for Demo (since deepface is not installed)
        import cv2
        import numpy as np
        
        # Load registered image
        img1 = cv2.imread(registered_img_path)
        if img1 is None:
            return jsonify({'success': False, 'message': 'Registered image not found on server'}), 404
            
        # Load captured image
        base64_img = image_data.split(',')[1] if ',' in image_data else image_data
        img2_bytes = base64.b64decode(base64_img)
        nparr = np.frombuffer(img2_bytes, np.uint8)
        img2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert to grayscale for better structure comparison
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Resize to standard dimensions
        g1 = cv2.resize(gray1, (200, 200))
        g2 = cv2.resize(gray2, (200, 200))
        
        # Crop the center of the registered image as a template
        # Assuming the face is generally centered in the webcam
        template = g1[40:160, 40:160]
        
        # Perform template matching
        res = cv2.matchTemplate(g2, template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        
        correlation = float(max_val)
        
        # If correlation (template match confidence) is greater than 0.35, consider it a match
        if correlation > 0.35:
            # 1. Record Transaction
            amount = float(data.get('totalAmount', 0.0))
            if amount > 0:
                conn = sqlite3.connect('database.db', timeout=10)
                c = conn.cursor()
                c.execute('INSERT INTO transactions (amount) VALUES (?)', (amount,))
                conn.commit()
                conn.close()
                
            # No stock deduction required since dataset only has name and price

            return jsonify({
                'success': True, 
                'message': 'Match Successful', 
                'user': {'name': full_name, 'email': email},
                'confidence': correlation
            })
        else:
            # Record Fraud Attempt
            conn = sqlite3.connect('database.db', timeout=10)
            c = conn.cursor()
            c.execute('INSERT INTO fraud_attempts DEFAULT VALUES')
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': False, 
                'message': 'FRAUD ALERT! Face does not match registered user.',
                'confidence': correlation
            })
            
    except Exception as e:
        import traceback
        err_trace = traceback.format_exc()
        print(f"Error in verify_face: {err_trace}")
        return jsonify({'success': False, 'message': f'Verification failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
