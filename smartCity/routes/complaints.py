import os
from flask import Blueprint, request, jsonify
from models import db, Complaint
from flask_jwt_extended import get_jwt, jwt_required
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from extensions import socketio

complaints_bp = Blueprint('complaints', __name__)

def get_deadline(category):
    category = category.lower()
    if "road" in category or "pothole" in category:
        return timedelta(hours=24)
    elif "water" in category or "leakage" in category:
        return timedelta(hours=12)
    elif "gutter" in category or "overflow" in category:
        return timedelta(hours=12)
    elif "garbage" in category:
        return timedelta(hours=18)
    elif "streetlight" in category:
        return timedelta(hours=48)
    return timedelta(hours=24) # Default

def get_severity(category):
    category = category.lower()
    if "road" in category or "water" in category or "gutter" in category:
        return "High"
    elif "garbage" in category:
        return "Medium"
    elif "streetlight" in category:
        return "Low"
    return "Medium"

@complaints_bp.route('', methods=['POST'])
@jwt_required()
def create_complaint():
    current_user = get_jwt()
    user_id = current_user['id']
    
    title = request.form.get('title')
    description = request.form.get('description')
    category = request.form.get('category')
    latitude = request.form.get('latitude')
    longitude = request.form.get('longitude')
    
    if not all([title, description, category, latitude, longitude]):
        return jsonify({"msg": "Missing required fields"}), 400
        
    image_file = request.files.get('image')
    image_url = None
    if image_file:
        filename = secure_filename(image_file.filename)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        new_filename = f"{timestamp}_{filename}"
        upload_path = os.path.join('uploads', new_filename)
        os.makedirs('uploads', exist_ok=True)
        image_file.save(upload_path)
        image_url = f"/uploads/{new_filename}"
        
    deadline = datetime.utcnow() + get_deadline(category)
    severity = get_severity(category)
    
    new_complaint = Complaint(
        user_id=user_id,
        title=title,
        description=description,
        category=category,
        latitude=float(latitude),
        longitude=float(longitude),
        image_url=image_url,
        deadline=deadline,
        severity=severity
    )
    db.session.add(new_complaint)
    db.session.commit()
    
    complaint_data = new_complaint.to_dict()
    socketio.emit('new_complaint', complaint_data, to='admin')
    
    return jsonify(complaint_data), 201

@complaints_bp.route('', methods=['GET'])
@jwt_required()
def get_complaints():
    current_user = get_jwt()
    role = current_user['role']
    
    if role == 'admin':
        complaints = Complaint.query.all()
    else:
        complaints = Complaint.query.filter_by(user_id=current_user['id']).all()
        
    return jsonify([c.to_dict() for c in complaints]), 200

@complaints_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_complaint(id):
    current_user = get_jwt()
    if current_user['role'] != 'admin':
        return jsonify({"msg": "Unauthorized"}), 403
        
    complaint = Complaint.query.get_or_404(id)
    
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        status = request.form.get('status')
        if status:
            complaint.status = status
            
        res_image = request.files.get('resolution_image')
        if res_image:
            filename = secure_filename(res_image.filename)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            new_filename = f"res_{timestamp}_{filename}"
            upload_path = os.path.join('uploads', new_filename)
            os.makedirs('uploads', exist_ok=True)
            res_image.save(upload_path)
            complaint.resolution_image_url = f"/uploads/{new_filename}"
    else:
        data = request.get_json()
        if data and 'status' in data:
            complaint.status = data['status']
        
    db.session.commit()
    
    socketio.emit('status_update', complaint.to_dict(), to=f"user_{complaint.user_id}")
    
    return jsonify(complaint.to_dict()), 200

@complaints_bp.route('/<int:id>/escalate', methods=['POST'])
@jwt_required()
def escalate_complaint(id):
    current_user = get_jwt()
    complaint = Complaint.query.get_or_404(id)
    
    if complaint.user_id != current_user['id']:
        return jsonify({"msg": "Unauthorized"}), 403
        
    if complaint.status in ['Completed', 'Rejected']:
        return jsonify({"msg": "Cannot escalate closed complaint"}), 400
        
    if datetime.utcnow() < complaint.deadline:
        return jsonify({"msg": "Deadline not passed yet"}), 400
        
    complaint.is_escalated = True
    db.session.commit()
    
    socketio.emit('escalated', complaint.to_dict(), to='admin')
    
    return jsonify({"msg": "Complaint escalated successfully", "complaint": complaint.to_dict()}), 200

@complaints_bp.route('/<int:id>/rate', methods=['POST'])
@jwt_required()
def rate_complaint(id):
    current_user = get_jwt()
    complaint = Complaint.query.get_or_404(id)
    
    if complaint.user_id != current_user['id']:
        return jsonify({"msg": "Unauthorized"}), 403
        
    if complaint.status != 'Completed':
        return jsonify({"msg": "Only completed complaints can be rated"}), 400
        
    data = request.get_json()
    rating = data.get('rating')
    
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({"msg": "Invalid rating, must be between 1 and 5"}), 400
        
    complaint.rating = rating
    db.session.commit()
    
    return jsonify({"msg": "Rating submitted successfully"}), 200
