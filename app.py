from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mysqldb import MySQL
from werkzeug.security import generate_password_hash, check_password_hash
import os
import jwt
import datetime
from dotenv import load_dotenv
from functools import wraps

# ---------------------- Load Environment ----------------------
load_dotenv()

app = Flask(__name__)
CORS(app)

# ---------------------- MySQL Config ----------------------
app.config['MYSQL_HOST'] = os.getenv('DB_HOST')
app.config['MYSQL_USER'] = os.getenv('DB_USER')
app.config['MYSQL_PASSWORD'] = os.getenv('DB_PASSWORD')
app.config['MYSQL_DB'] = os.getenv('DB_NAME')

# JWT Secret
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'supersecret')

# Initialize MySQL
mysql = MySQL(app)

# ---------------------- Helper Functions ----------------------
def token_required(f):
    """Decorator to protect routes with JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            bearer = request.headers['Authorization']
            token = bearer.split(" ")[1] if " " in bearer else bearer

        if not token:
            return jsonify({'error': 'Token missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = {
                'id': data['id'],
                'name': data['name'],
                'email': data['email']
            }
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

# ---------------------- Auth Routes ----------------------
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email').lower()
    password = data.get('password')

    with mysql.connection.cursor(dictionary=True) as cur:
        # Check if email already exists
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            return jsonify({'error': 'Email already exists'}), 400

        # Insert new user
        hashed_pw = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
            (name, email, hashed_pw)
        )
        mysql.connection.commit()

    return jsonify({'message': 'Signup successful'}), 200


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email').lower()
    password = data.get('password')

    with mysql.connection.cursor(dictionary=True) as cur:
        cur.execute("SELECT id, name, email, password FROM users WHERE email=%s", (email,))
        user = cur.fetchone()

    if user and check_password_hash(user['password'], password):
        token = jwt.encode({
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({'token': token, 'name': user['name'], 'email': user['email']}), 200

    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/profile', methods=['GET'])
@token_required
def profile(current_user):
    """Return current logged-in user info"""
    return jsonify({'user': current_user}), 200

# ---------------------- Recipe Routes ----------------------
@app.route('/recipes', methods=['GET'])
@token_required
def get_recipes(current_user):
    query = request.args.get('q', '').lower()

    with mysql.connection.cursor(dictionary=True) as cur:
        if query:
            cur.execute(
                "SELECT id, label, image, mealType, dietLabels, ingredientLines, totalTime "
                "FROM recipes WHERE LOWER(label) LIKE %s",
                (f"%{query}%",)
            )
        else:
            cur.execute(
                "SELECT id, label, image, mealType, dietLabels, ingredientLines, totalTime FROM recipes"
            )

        recipes = cur.fetchall()

    recipe_list = []
    for r in recipes:
        recipe_list.append({
            'id': r['id'],
            'label': r['label'],
            'image': r['image'],
            'mealType': r['mealType'],
            'dietLabels': r['dietLabels'].split(',') if r['dietLabels'] else [],
            'ingredientLines': r['ingredientLines'].split('|') if r['ingredientLines'] else [],
            'totalTime': r['totalTime']
        })

    return jsonify(recipe_list), 200

# ---------------------- Main ----------------------
if __name__ == "__main__":
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
