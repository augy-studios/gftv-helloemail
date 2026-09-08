let isRegisterMode = false;
let authToken = localStorage.getItem('hellomail_token');

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    bindEvents();
    if (authToken) {
        showDashboard();
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

    document.getElementById('toggleAuthMode').onclick = () => {
        isRegisterMode = !isRegisterMode;
        document.getElementById('authTitle').innerText = isRegisterMode ? 'Register' : 'Sign In';
        document.getElementById('emailGroup').style.display = isRegisterMode ? 'flex' : 'none';
        document.getElementById('submitAuthBtn').innerText = isRegisterMode ? 'Register' : 'Login';
        document.getElementById('toggleText').innerText = isRegisterMode ? 'Already have an account?' : 'Need an account?';
        document.getElementById('toggleAuthMode').innerText = isRegisterMode ? 'Login' : 'Register';
    };

    document.getElementById('authForm').onsubmit = async (e) => {
        e.preventDefault();
        const action = isRegisterMode ? 'register' : 'login';
        const payload = {
            action,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            email: document.getElementById('email').value
        };

        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.token) {
            authToken = data.token;
            localStorage.setItem('hellomail_token', authToken);
            showDashboard();
        } else {
            alert(data.error || 'Authentication failed');
        }
    };

    document.getElementById('passkeyAuthBtn').onclick = async () => {
        alert('Passkey authentication initiated. (Connects with SimpleWebAuthn API)');
    };

    document.getElementById('registerPasskeyBtn').onclick = async () => {
        alert('Registering device Passkey...');
    };

    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('hellomail_token');
        authToken = null;
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
    };

    document.getElementById('createAliasForm').onsubmit = async (e) => {
        e.preventDefault();
        const prefix = document.getElementById('aliasPrefix').value;
        const destination = document.getElementById('destinationEmail').value;

        const res = await fetch('/api/aliases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'create',
                prefix,
                destination
            })
        });

        if (res.ok) {
            document.getElementById('aliasPrefix').value = '';
            loadAliases();
        } else {
            alert('Failed to create alias.');
        }
    };
}

async function showDashboard() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadAliases();
}

async function loadAliases() {
    const res = await fetch('/api/aliases?action=list', {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    const data = await res.json();
    const list = document.getElementById('aliasList');
    list.innerHTML = '';

    if (data.aliases) {
        data.aliases.forEach(a => {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${a.alias_address}</td>
        <td>${a.destination_email}</td>
        <td>${a.is_active ? 'Active' : 'Disabled'}</td>
        <td><button class="btn btn-danger" onclick="deleteAlias('${a.id}')">Delete</button></td>
      `;
            list.appendChild(row);
        });
    }
}

async function deleteAlias(id) {
    await fetch('/api/aliases', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            action: 'delete',
            id
        })
    });
    loadAliases();
}