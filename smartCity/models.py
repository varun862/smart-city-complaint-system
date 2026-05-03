from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), default="citizen") # 'citizen' or 'admin'
    session_token = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Complaint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default="Pending")
    severity = db.Column(db.String(50))
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.String(255))
    resolution_image_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    deadline = db.Column(db.DateTime, nullable=False)
    rating = db.Column(db.Integer, nullable=True) # 1-5 stars
    is_escalated = db.Column(db.Boolean, default=False)
    
    user = db.relationship('User', backref=db.backref('complaints', lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "severity": self.severity,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "image_url": self.image_url,
            "resolution_image_url": self.resolution_image_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "rating": self.rating,
            "is_escalated": self.is_escalated,
            "is_overdue": datetime.utcnow() > self.deadline if self.deadline else False
        }
