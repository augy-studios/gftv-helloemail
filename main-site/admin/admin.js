let authToken = localStorage.getItem('hellomail_token');

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    bindEvents();
    if (!authToken) {
        window.location.href = '/';
    } else {
        loadUsers();
    }
});

function initTheme() {
    const savedTheme = localStorage.getItem('hellomail_theme') || 'classic';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function bindEvents() {
    document.getElementById('openThemeModal').onclick = () => document.getElementById('themeModal').style.display = 'flex';
    document.getElementById('closeThemeModal').onclick = () => document.getElementById('themeModal').style.display = 'none';

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = (e) => {
            const theme = e.target.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('hellomail_theme', theme);
            document.getElementById('themeModal').style.display = 'none';
        };
    });

    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('hellomail_token');
        window.location.href = '/';
    };
}

async function loadUsers() {
    const res = await fetch('/api/admin', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });

    if (res.status === 403) {
        alert('Access denied: Administrator credentials required.');
        window.location.href = '/';
        return;
    }

    const data = await res.json();
    const list = document.getElementById('userList');
    list.innerHTML = '';

    if (data.users && data.users.length > 0) {
        data.users.forEach(u => {
            const row = document.createElement('tr');
            const createdDate = new Date(u.created_at).toLocaleDateString();

            row.innerHTML = `
                <td>${u.username}</td>
                <td>${u.email || '-'}</td>
                <td>${createdDate}</td>
                <td><span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
                <td><span class="badge ${u.is_approved ? 'badge-approved' : 'badge-pending'}">${u.is_approved ? 'Approved' : 'Pending'}</span></td>
                <td>
                    <button class="btn ${u.is_approved ? 'btn-revoke' : 'btn-approve'}" onclick="toggleApproval('${u.id}', ${!u.is_approved})">
                        ${u.is_approved ? 'Revoke' : 'Approve'}
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
    } else {
        list.innerHTML = '<tr><td colspan="6">No registered users found.</td></tr>';
    }
}

async function toggleApproval(userId, isApproved) {
    const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            userId,
            isApproved
        })
    });

    if (res.ok) {
        loadUsers();
    } else {
        const error = await res.json();
        alert(error.error || 'Failed to update approval status.');
    }
}
