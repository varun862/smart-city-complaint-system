const BACKEND_URL = (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '3000') ? 'http://127.0.0.1:5000' : '';
const API_URL = `${BACKEND_URL}/api`;

const state = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    complaints: [],
    analytics: null,
    currentMap: null,
    marker: null,
    socket: null,
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateState(key, value) {
    state[key] = value;
    if (key === 'token') {
        if (value) localStorage.setItem('token', value);
        else localStorage.removeItem('token');
    }
    if (key === 'user') {
        if (value) localStorage.setItem('user', JSON.stringify(value));
        else localStorage.removeItem('user');
    }
}

async function apiCall(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token && !options.isFormData) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    if (!options.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 || res.status === 422) {
                updateState('token', null);
                updateState('user', null);
                renderLogin();
            }
            throw new Error(data.msg || 'API Error');
        }
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        if (err.message.includes('Token has expired') || 
            err.message.includes('Signature verification failed') || 
            err.message.includes('Missing Authorization') || 
            err.message.includes('Subject must be a string') || 
            err.message.includes('Token has been revoked') || 
            err.message.includes('Another admin session is active')) {
            updateState('token', null);
            updateState('user', null);
            renderLogin();
        }
        throw err;
    }
}

async function apiCallFormData(endpoint, formData, method = 'POST') {
    const headers = { 'Authorization': `Bearer ${state.token}` };
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { method: method, headers, body: formData });
        let data;
        try { data = await res.json(); } catch(e) { data = {}; }
        if (!res.ok) throw new Error(data.msg || 'API Error');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

function renderApp() {
    if (!state.token) {
        renderLogin();
    } else {
        setupSocket();
        if (state.user?.role === 'admin') {
            renderAdminDashboard();
        } else {
            renderCitizenDashboard();
        }
    }
}

function setupSocket() {
    if (!state.socket && state.user) {
        state.socket = io(BACKEND_URL || undefined);
        
        state.socket.on('connect', () => {
            state.socket.emit('join', { room: state.user.role === 'admin' ? 'admin' : `user_${state.user.id}` });
        });
        
        state.socket.on('new_complaint', (complaint) => {
            showToast(`New Emergency: ${complaint.title}`, 'error');
            if(state.user.role === 'admin') renderAdminDashboard();
        });
        
        state.socket.on('status_update', (complaint) => {
            showToast(`Complaint Update: Status changed to ${complaint.status}`, 'info');
            if(state.user.role !== 'admin') renderCitizenDashboard();
        });
        
        state.socket.on('escalated', (complaint) => {
            showToast(`ESCALATED: ${complaint.title} needs immediate attention!`, 'error');
            if(state.user.role === 'admin') renderAdminDashboard();
        });
    }
}

window.renderLogin = function() {
    document.getElementById('app').innerHTML = `
        <div class="auth-wrapper glass">
            <div class="auth-card">
                <h1>Smart Civic</h1>
                <p style="margin-bottom: 2rem; color: #94a3b8">Login to continue</p>
                <form id="loginForm">
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="email" class="input-control" required placeholder="admin@system.com">
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="password" class="input-control" required placeholder="admin123">
                    </div>
                    <button type="submit" class="btn btn-primary">Login</button>
                    <p style="margin-top: 1rem">New here? <a href="#" onclick="renderRegister(event)" style="color: var(--primary)">Register</a></p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const res = await apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            updateState('token', res.access_token);
            const userRes = await apiCall('/auth/me');
            updateState('user', userRes);
            showToast('Logged in successfully', 'success');
            renderApp();
        } catch (e) { }
    };
}

window.renderRegister = function(e) {
    if(e) e.preventDefault();
    document.getElementById('app').innerHTML = `
        <div class="auth-wrapper glass">
            <div class="auth-card">
                <h1>Register</h1>
                <form id="registerForm">
                    <div class="input-group">
                        <label>Name</label>
                        <input type="text" id="regName" class="input-control" required>
                    </div>
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="regEmail" class="input-control" required>
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="regPassword" class="input-control" required>
                    </div>
                    <div class="input-group">
                        <label>Role</label>
                        <select id="regRole" class="input-control">
                            <option value="citizen">Citizen</option>
                            <option value="admin">Municipality Admin</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Sign Up</button>
                    <p style="margin-top: 1rem">Already have an account? <a href="#" onclick="renderLogin()" style="color: var(--primary)">Login</a></p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('registerForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const role = document.getElementById('regRole').value;
        try {
            await apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password, role })
            });
            showToast('Registration successful! Please login.', 'success');
            renderLogin();
        } catch (e) { }
    };
}

function getNavbar() {
    return `
        <nav class="navbar glass">
            <h2>Smart Civic <span style="color: var(--primary); font-size: 1rem">${state.user?.role.toUpperCase()}</span></h2>
            <div style="display:flex; gap: 1rem; align-items:center;">
                <span style="color: #cbd5e1"><i class="fa fa-user"></i> ${state.user?.name}</span>
                <button onclick="logout()" class="btn btn-outline" style="padding: 0.5rem 1rem">Logout</button>
            </div>
        </nav>
    `;
}

window.logout = function() {
    if(state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }
    updateState('token', null);
    updateState('user', null);
    renderApp();
}

async function fetchComplaints() {
    state.complaints = await apiCall('/complaints');
}

async function renderCitizenDashboard() {
    await fetchComplaints();
    
    document.getElementById('app').innerHTML = `
        ${getNavbar()}
        <div class="container dashboard-grid">
            <div class="glass card">
                <h3 style="margin-bottom:1rem"><i class="fa fa-plus-circle"></i> New Complaint</h3>
                <form id="complaintForm">
                    <div class="input-group">
                        <label>Title</label>
                        <input type="text" id="cTitle" class="input-control" required placeholder="Short description of the issue">
                    </div>
                    <div class="input-group">
                        <label>Category</label>
                        <select id="cCategory" class="input-control" required>
                            <option value="Road Damage">Road Damage (Potholes)</option>
                            <option value="Water Leakage">Water Leakage</option>
                            <option value="Gutter Overflow">Gutter Overflow</option>
                            <option value="Garbage Overflow">Garbage Overflow</option>
                            <option value="Streetlight Failure">Streetlight Failure</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Description</label>
                        <textarea id="cDesc" class="input-control" rows="3" required placeholder="Detailed location and issue description"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Location (Click on map)</label>
                        <div id="map"></div>
                        <input type="hidden" id="cLat" required>
                        <input type="hidden" id="cLng" required>
                    </div>
                    <div class="input-group">
                        <label>Image Proof</label>
                        <input type="file" id="cImage" class="input-control" accept="image/*">
                    </div>
                    <button type="submit" class="btn btn-primary" id="submitBtn">Submit Complaint</button>
                </form>
            </div>
            <div class="glass card" style="height: 100%;">
                <h3><i class="fa fa-list"></i> My Reports</h3>
                <div class="complaint-list" id="complaintsList" style="margin-top: 1.5rem">
                    ${renderComplaintsList()}
                </div>
            </div>
        </div>
    `;

    setTimeout(() => initMap(), 100);

    document.getElementById('complaintForm').onsubmit = async (e) => {
        e.preventDefault();
        const lat = document.getElementById('cLat').value;
        const lng = document.getElementById('cLng').value;
        if (!lat || !lng) return showToast('Please select a location on the map', 'error');

        const formData = new FormData();
        formData.append('title', document.getElementById('cTitle').value);
        formData.append('category', document.getElementById('cCategory').value);
        formData.append('description', document.getElementById('cDesc').value);
        formData.append('latitude', lat);
        formData.append('longitude', lng);
        const imageFile = document.getElementById('cImage').files[0];
        if (imageFile) formData.append('image', imageFile);

        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            await apiCallFormData('/complaints', formData);
            showToast('Complaint submitted successfully', 'success');
            renderCitizenDashboard();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Submit Complaint';
        }
    };
}

async function renderAdminDashboard() {
    await fetchComplaints();
    const analytics = await apiCall('/dashboard/analytics');
    state.analytics = analytics;

    document.getElementById('app').innerHTML = `
        ${getNavbar()}
        <div class="container">
            <h2 style="margin-bottom: 1.5rem">Overview</h2>
            <div class="metrics-grid">
                <div class="glass metric-card">
                    <p style="color: #94a3b8">Total Complaints</p>
                    <h3>${analytics.total}</h3>
                </div>
                <div class="glass metric-card">
                    <p style="color: #94a3b8">Pending Actions</p>
                    <h3 style="color: #f59e0b">${analytics.pending}</h3>
                </div>
                <div class="glass metric-card">
                    <p style="color: #94a3b8">Escalated Priority</p>
                    <h3 style="color: #ef4444">${analytics.escalated}</h3>
                </div>
                <div class="glass metric-card">
                    <p style="color: #94a3b8">Citizen Satisfaction</p>
                    <h3 style="color: #10b981"><i class="fa fa-star"></i> ${analytics.avg_rating}</h3>
                </div>
            </div>

            <div class="dashboard-grid" style="grid-template-columns: 1fr; margin-top: 2rem">
                <div class="glass card">
                    <h3><i class="fa fa-tasks"></i> Complaint Management Queue</h3>
                    <div class="complaint-list" id="complaintsList" style="margin-top: 1.5rem">
                        ${renderComplaintsList()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderComplaintsList() {
    if (state.complaints.length === 0) return '<p style="color: #94a3b8; text-align: center; padding: 2rem;">No records found.</p>';
    
    const sorted = [...state.complaints].sort((a,b) => {
        if(a.is_escalated && !b.is_escalated) return -1;
        if(!a.is_escalated && b.is_escalated) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    return sorted.map(c => `
        <div class="glass complaint-item" onclick="openComplaintModal(${c.id})">
            <div class="complaint-header">
                <h4 style="font-size: 1.1rem">${c.title}</h4>
                <div>
                    ${c.is_escalated ? `<span class="badge badge-Escalated"><i class="fa fa-fire"></i> Escalated</span>` : ''}
                    ${c.is_overdue && c.status != 'Completed' && c.status != 'Rejected' ? `<span class="badge badge-Overdue">Overdue</span>` : ''}
                    <span class="badge badge-${c.status.replace(' ','\\ ')}">${c.status}</span>
                </div>
            </div>
            <div class="complaint-body">
                <span><i class="fa fa-tag"></i> ${c.category} &nbsp; | &nbsp; <i class="fa fa-clock"></i> Deadline: ${new Date(c.deadline).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

window.openComplaintModal = function(id) {
    const c = state.complaints.find(x => x.id == id);
    if (!c) return;

    let actionHtml = '';
    if (state.user.role === 'admin') {
        actionHtml = `
            <div id="actionArea_${c.id}" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border)">
                <label style="color:#cbd5e1; font-size:1rem; display:block; margin-bottom:10px">Update Status Action:</label>
                <div style="display:flex; gap:10px;">
                    ${c.status !== 'Pending' ? `<button class="btn btn-outline" onclick="updateStatus(${c.id}, 'Pending')" style="padding: 10px; flex:1">Pending</button>` : ''}
                    ${c.status !== 'In Progress' ? `<button class="btn btn-outline" style="color:#3b82f6; border-color:#3b82f6" onclick="updateStatus(${c.id}, 'In Progress')" style="padding: 10px; flex:1">In Progress</button>` : ''}
                    <button class="btn btn-outline" style="color: var(--success); border-color: var(--success); flex:1;" onclick="showResolveForm(${c.id})">Mark Resolved</button>
                    <button class="btn btn-outline" style="color: var(--danger); border-color: var(--danger); flex:1;" onclick="updateStatus(${c.id}, 'Rejected')">Reject</button>
                </div>
            </div>
        `;
    } else {
        if (c.status === 'Completed' && !c.rating) {
            actionHtml = `
                <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border)">
                    <label style="color:#cbd5e1; font-size:1rem; display:block; margin-bottom:10px">Rate the Support (1-5):</label>
                    <div style="display:flex; gap:10px;">
                        <select id="ratingInput_${c.id}" class="input-control" style="width:100px">
                            <option value="5">5 - Excellent</option>
                            <option value="4">4 - Good</option>
                            <option value="3">3 - Average</option>
                            <option value="2">2 - Poor</option>
                            <option value="1">1 - Terrible</option>
                        </select>
                        <button class="btn btn-primary" onclick="submitRating(${c.id})" style="width:auto">Submit Rating</button>
                    </div>
                </div>
            `;
        } else if (c.rating) {
            actionHtml = `<div style="margin-top:1.5rem; font-size: 1.2rem; color: #10b981"><i class="fa fa-star"></i> You rated this: ${c.rating} out of 5</div>`;
        }

        if (c.is_overdue && !c.is_escalated && c.status !== 'Completed' && c.status !== 'Rejected') {
            actionHtml += `
                <div style="margin-top: 1.5rem;">
                    <button class="btn btn-danger" onclick="escalateComplaint(${c.id})">
                        <i class="fa fa-exclamation-triangle"></i> Escalate Complaint (Response Overdue!)
                    </button>
                </div>
            `;
        }
    }

    const modalHtml = `
        <div class="modal-backdrop" id="cModal_${c.id}" onclick="closeModal('cModal_${c.id}')">
            <div class="glass modal-content" onclick="event.stopPropagation()">
                <button class="modal-close" onclick="closeModal('cModal_${c.id}')">&times;</button>
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem">
                    <h2 style="font-size: 1.8rem; padding-right: 2rem;">${c.title}</h2>
                    <span class="badge badge-${c.status.replace(' ','\\ ')}">${c.status}</span>
                </div>
                <p style="color: #94a3b8; margin-bottom: 1rem; font-size: 1.1rem">
                    <i class="fa fa-user"></i> ${c.user_name} &nbsp;|&nbsp; 
                    <i class="fa fa-exclamation-circle" style="color: ${c.severity === 'High' ? '#ef4444' : '#f59e0b'}"></i> ${c.severity} Severity
                </p>
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem">
                    <p style="font-size: 1.1rem; line-height: 1.6;">${c.description}</p>
                </div>
                
                ${c.image_url ? `<img src="${c.image_url}" class="modal-img" alt="Proof Image">` : ''}
                ${c.resolution_image_url ? `
                    <div style="margin-top:1rem; padding: 1rem; border: 1px solid var(--success); background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                        <h4 style="color: var(--success); margin-bottom: 0.5rem"><i class="fa fa-check-circle"></i> Resolution Proof</h4>
                        <img src="${c.resolution_image_url}" class="modal-img" alt="Resolution Image" style="margin:0">
                    </div>
                ` : ''}
                
                <div style="margin-top: 1rem; color: #94a3b8; display: flex; flex-direction:column; gap:0.5rem">
                    <p><i class="fa fa-calendar"></i> Reported: ${new Date(c.created_at).toLocaleString()}</p>
                    <p style="color: ${c.is_overdue ? '#ef4444' : '#94a3b8'}">
                        <i class="fa fa-clock"></i> Deadline: ${new Date(c.deadline).toLocaleString()} 
                        ${c.is_overdue && c.status != 'Completed' && c.status != 'Rejected' ? '<strong>(ACTION OVERDUE)</strong>' : ''}
                    </p>
                </div>
                
                ${actionHtml}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if(el) el.remove();
}

window.showResolveForm = function(id) {
    const actionArea = document.getElementById(`actionArea_${id}`);
    if (actionArea) {
        actionArea.innerHTML = `
            <label style="color:#cbd5e1; font-size:1rem; display:block; margin-bottom:10px">Upload Resolution Proof Image (Optional):</label>
            <input type="file" id="resImage_${id}" class="input-control" accept="image/*" style="margin-bottom:10px">
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary" style="flex:1" onclick="confirmResolve(${id})">Confirm Resolution</button>
                <button class="btn btn-outline" style="flex:1" onclick="closeModal('cModal_${id}'); openComplaintModal(${id})">Cancel</button>
            </div>
        `;
    }
}

window.confirmResolve = async function(id) {
    const fileInput = document.getElementById(`resImage_${id}`);
    const file = fileInput ? fileInput.files[0] : null;
    
    if (file) {
        const formData = new FormData();
        formData.append('status', 'Completed');
        formData.append('resolution_image', file);
        try {
            await apiCallFormData(`/complaints/${id}`, formData, 'PUT');
            showToast('Complaint resolved with image', 'success');
            closeModal(`cModal_${id}`);
            renderApp();
        } catch (e) { }
    } else {
        updateStatus(id, 'Completed');
    }
}

window.updateStatus = async function(id, newStatus) {
    try {
        await apiCall(`/complaints/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        showToast(`Status updated to ${newStatus}`, 'success');
        closeModal(`cModal_${id}`);
        renderApp(); // Reload dash
    } catch (e) { }
}

window.submitRating = async function(id) {
    const rating = parseInt(document.getElementById(`ratingInput_${id}`).value);
    if (!rating || rating < 1 || rating > 5) return showToast('Rating must be between 1 and 5', 'error');
    
    try {
        await apiCall(`/complaints/${id}/rate`, {
            method: 'POST',
            body: JSON.stringify({ rating })
        });
        showToast('Rating submitted', 'success');
        closeModal(`cModal_${id}`);
        renderApp();
    } catch(e) {}
}

window.escalateComplaint = async function(id) {
    try {
        await apiCall(`/complaints/${id}/escalate`, { method: 'POST' });
        showToast('Complaint escalated immediately', 'success');
        closeModal(`cModal_${id}`);
        renderApp();
    } catch(e) {}
}

function initMap() {
    if (state.currentMap) {
        state.currentMap.remove();
    }
    state.currentMap = L.map('map').setView([20.5937, 78.9629], 4); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(state.currentMap);

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            state.currentMap.setView([position.coords.latitude, position.coords.longitude], 14);
        });
    }

    state.currentMap.on('click', function(e) {
        if (state.marker) state.currentMap.removeLayer(state.marker);
        state.marker = L.marker(e.latlng).addTo(state.currentMap);
        document.getElementById('cLat').value = e.latlng.lat;
        document.getElementById('cLng').value = e.latlng.lng;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderApp();
});
