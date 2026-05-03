# Smart City Complaint System

A real-time, GIS-integrated web application designed for urban infrastructure maintenance and civic accountability.

## 🌟 Key Features
- **Real-time Notifications**: Instant updates for admins and citizens via Socket.IO.
- **Map Integration**: Precise location tagging for complaints using Leaflet.js.
- **Automated Escalation**: Deadline-driven tracking for unresolved issues.
- **Analytical Dashboard**: Comprehensive overview of city-wide metrics for administrators.

## 🛠️ Technology Stack
- **Backend**: Python 3, Flask, SQLAlchemy, SQLite, JWT, Socket.IO.
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Leaflet.js.
- **Server**: Eventlet (for optimized WebSocket support).

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Pip

### 2. Installation
1. Clone the repository (once pushed to GitHub).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 3. Running the App
1. Initialize the database (optional, app does this on start):
   ```bash
   python alter_db.py
   ```
2. Start the server:
   ```bash
   python app.py
   ```
3. Open `http://127.0.0.1:5000` in your browser.

