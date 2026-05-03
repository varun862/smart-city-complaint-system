import os
from flask import Flask, send_from_directory, jsonify, request
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_socketio import join_room
from models import db
from datetime import timedelta
from extensions import socketio

bcrypt = Bcrypt()
jwt = JWTManager()

def create_app():
    app = Flask(__name__, static_folder=".", static_url_path="")
    
    # Configure SQLite database
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///civic.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Configure JWT
    app.config['JWT_SECRET_KEY'] = 'super-secret-key-that-is-at-least-32-characters-long'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    
    # Ensure upload directory exists
    os.makedirs('uploads', exist_ok=True)
    
    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)
    
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        if jwt_payload.get("role") == "admin":
            from models import User
            user = db.session.get(User, jwt_payload["id"])
            if user and user.session_token != jwt_payload.get("session_token"):
                return True
        return False
    
    with app.app_context():
        db.create_all()
        from models import User
        if not User.query.filter_by(email="admin@system.com").first():
            hashed_pw = bcrypt.generate_password_hash("admin123").decode('utf-8')
            admin = User(name="Municipality Admin", email="admin@system.com", password_hash=hashed_pw, role="admin")
            db.session.add(admin)
            db.session.commit()
            print("Default admin created (admin@system.com / admin123)")
            
    # Register blueprints safely
    try:
        from routes.auth import auth_bp
        from routes.complaints import complaints_bp
        from routes.dashboard import dashboard_bp
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.register_blueprint(complaints_bp, url_prefix='/api/complaints')
        app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    except ImportError as e:
        print(f"Routes not fully implemented yet: {e}")

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory('uploads', filename)

    @app.route('/favicon.ico')
    def favicon():
        return '', 204

    @app.before_request
    def handle_options_request():
        if request.method == 'OPTIONS':
            return ('', 204)

    @app.after_request
    def after_request(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS'
        return response

    @socketio.on('join')
    def handle_join(data):
        room = data.get('room')
        if room:
            join_room(room)
            
    return app

if __name__ == '__main__':
    app = create_app()
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)
