from flask import Blueprint, request, jsonify
from models import db, User
from app import bcrypt
from flask_jwt_extended import create_access_token, get_jwt, jwt_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({"msg": "Missing required fields"}), 400
        
    email = data['email'].strip().lower()
    
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email already exists"}), 409
        
    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(
        name=data['name'],
        email=email,
        password_hash=hashed_pw,
        role='citizen' # Only citizens can be registered
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    access_token = create_access_token(identity=str(new_user.id), additional_claims={"id": new_user.id, "role": new_user.role, "name": new_user.name})
    return jsonify({"msg": "User created", "access_token": access_token}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"msg": "Missing required fields"}), 400
        
    email = data['email'].strip().lower()
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({"msg": "Invalid credentials (User not found)"}), 401
    if not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({"msg": "Invalid credentials (Wrong password)"}), 401
        
    import uuid
    session_token = None
    if user.role == 'admin':
        session_token = str(uuid.uuid4())
        user.session_token = session_token
        db.session.commit()
        
    access_token = create_access_token(identity=str(user.id), additional_claims={"id": user.id, "role": user.role, "name": user.name, "session_token": session_token})
    return jsonify({"msg": "Login successful", "access_token": access_token}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user = get_jwt()
    
    if current_user.get('role') == 'admin':
        user = User.query.get(current_user['id'])
        if not user or user.session_token != current_user.get('session_token'):
            return jsonify({"msg": "Another admin session is active. Please login again."}), 401
            
    return jsonify(current_user), 200
