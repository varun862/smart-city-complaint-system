from flask import Blueprint, jsonify
from models import db, Complaint
from flask_jwt_extended import get_jwt, jwt_required

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    current_user = get_jwt()
    if current_user['role'] != 'admin':
        return jsonify({"msg": "Unauthorized"}), 403
        
    total = Complaint.query.count()
    pending = Complaint.query.filter_by(status='Pending').count()
    in_progress = Complaint.query.filter_by(status='In Progress').count()
    completed = Complaint.query.filter_by(status='Completed').count()
    escalated = Complaint.query.filter_by(is_escalated=True).count()
    
    all_complaints = Complaint.query.all()
    categories = {}
    total_rating = 0
    rated_count = 0
    
    for c in all_complaints:
        categories[c.category] = categories.get(c.category, 0) + 1
        if c.rating:
            total_rating += c.rating
            rated_count += 1
            
    avg_rating = total_rating / rated_count if rated_count > 0 else 0
    
    return jsonify({
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "escalated": escalated,
        "categories": categories,
        "avg_rating": round(avg_rating, 1)
    }), 200
