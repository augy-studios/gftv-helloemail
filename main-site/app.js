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

// Modal Helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function showNoticeModal(title, message) {
    document.getElementById('appNoticeTitle').innerText = title;
    document.getElementById('appNoticeMessage').innerText = message;
    openModal('appNoticeModal');
}

// WebAuthn Buffer Helpers
function bufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    let string = '';
    for (let j = 0; j < bytes.byteLength; j++) {
        string += String.fromCharCode(bytes[j]);
    }
    return btoa(string)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64URLToBuffer(base64URL) {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function bindEvents() {
    // Theme Modal Events
    document.getElementById('openThemeModal').onclick = () => openModal('themeModal');
    document.getElementById('closeThemeModal').onclick = () => closeModal('themeModal');

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.onclick = (e) => {
            const theme = e.target.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('hellomail_theme', theme);
            closeModal('themeModal');
        };
    });

    // Close Modal Button Handlers
    document.getElementById('closeRegSuccessModal').onclick = () => closeModal('registrationSuccessModal');
    document.getElementById('confirmRegSuccessBtn').onclick = () => closeModal('registrationSuccessModal');

    document.getElementById('closeAdminApprovalModal').onclick = () => closeModal('adminApprovalModal');
    document.getElementById('confirmAdminApprovalBtn').onclick = () => closeModal('adminApprovalModal');

    document.getElementById('closePasskeyModal').onclick = () => closeModal('passkeySetupModal');
    document.getElementById('cancelPasskeyBtn').onclick = () => closeModal('passkeySetupModal');

    document.getElementById('closeAppNoticeModal').onclick = () => closeModal('appNoticeModal');
    document.getElementById('confirmAppNoticeBtn').onclick = () => closeModal('appNoticeModal');

    // Auth Mode Toggle
    document.getElementById('toggleAuthMode').onclick = () => {
        isRegisterMode = !isRegisterMode;
        document.getElementById('authTitle').innerText = isRegisterMode ? 'Register' : 'Sign In';
        document.getElementById('emailGroup').style.display = isRegisterMode ? 'flex' : 'none';
        document.getElementById('submitAuthBtn').innerText = isRegisterMode ? 'Register' : 'Login';
        document.getElementById('toggleText').innerText = isRegisterMode ? 'Already have an account?' : 'Need an account?';
        document.getElementById('toggleAuthMode').innerText = isRegisterMode ? 'Login' : 'Register';
    };

    // Authentication Form Handler
    document.getElementById('authForm').onsubmit = async (e) => {
        e.preventDefault();
        const action = isRegisterMode ? 'register' : 'login';
        const payload = {
            action,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            email: document.getElementById('email').value
        };

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (action === 'register') {
                    if (data.message && data.message.includes('approve')) {
                        openModal('adminApprovalModal');
                    } else {
                        openModal('registrationSuccessModal');
                    }
                } else if (data.token) {
                    authToken = data.token;
                    localStorage.setItem('hellomail_token', authToken);
                    showDashboard();
                }
            } else {
                if (res.status === 403 || (data.error && data.error.includes('pending administrator approval'))) {
                    openModal('adminApprovalModal');
                } else {
                    showNoticeModal('Authentication Error', data.error || 'Authentication failed');
                }
            }
        } catch (err) {
            showNoticeModal('Error', 'Network error encountered during authentication.');
        }
    };

    // Passkey Login Handler
    document.getElementById('passkeyAuthBtn').onclick = async () => {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            showNoticeModal('Username Required', 'Please enter your username above to sign in with a passkey.');
            return;
        }

        if (!window.PublicKeyCredential) {
            showNoticeModal('Unsupported Browser', 'Passkeys are not supported on this browser.');
            return;
        }

        try {
            const optRes = await fetch('/api/passkey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login-options',
                    username
                })
            });

            const options = await optRes.json();
            if (!optRes.ok) throw new Error(options.error || 'Failed to initialize passkey login.');

            options.challenge = base64URLToBuffer(options.challenge);
            if (options.allowCredentials) {
                options.allowCredentials = options.allowCredentials.map(c => ({
                    ...c,
                    id: base64URLToBuffer(c.id)
                }));
            }

            const assertion = await navigator.credentials.get({
                publicKey: options
            });

            const credentialJSON = {
                id: assertion.id,
                rawId: bufferToBase64URL(assertion.rawId),
                type: assertion.type,
                response: {
                    clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
                    authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
                    signature: bufferToBase64URL(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? bufferToBase64URL(assertion.response.userHandle) : null
                }
            };

            const verifyRes = await fetch('/api/passkey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login-verify',
                    username,
                    credential: credentialJSON
                })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
                if (verifyRes.status === 403) {
                    openModal('adminApprovalModal');
                    return;
                }
                throw new Error(verifyData.error || 'Passkey login verification failed.');
            }

            authToken = verifyData.token;
            localStorage.setItem('hellomail_token', authToken);
            showDashboard();
        } catch (err) {
            showNoticeModal('Passkey Login Failed', err.message || 'Passkey authentication failed.');
        }
    };

    // Open Passkey Registration Modal
    document.getElementById('registerPasskeyBtn').onclick = () => {
        openModal('passkeySetupModal');
    };

    // Execute Passkey Registration
    document.getElementById('startPasskeySetupBtn').onclick = async () => {
        if (!window.PublicKeyCredential) {
            closeModal('passkeySetupModal');
            showNoticeModal('Unsupported Browser', 'Passkeys are not supported on this browser.');
            return;
        }

        try {
            const optRes = await fetch('/api/passkey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    action: 'register-options'
                })
            });

            const options = await optRes.json();
            if (!optRes.ok) throw new Error(options.error || 'Failed to retrieve passkey setup options.');

            options.challenge = base64URLToBuffer(options.challenge);
            options.user.id = new TextEncoder().encode(options.user.id);

            if (options.excludeCredentials) {
                options.excludeCredentials = options.excludeCredentials.map(c => ({
                    ...c,
                    id: base64URLToBuffer(c.id)
                }));
            }

            const credential = await navigator.credentials.create({
                publicKey: options
            });

            const credentialJSON = {
                id: credential.id,
                rawId: bufferToBase64URL(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
                    attestationObject: bufferToBase64URL(credential.response.attestationObject)
                }
            };

            const verifyRes = await fetch('/api/passkey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    action: 'register-verify',
                    credential: credentialJSON
                })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to verify passkey registration.');

            closeModal('passkeySetupModal');
            showNoticeModal('Success', 'Passkey successfully registered!');
        } catch (err) {
            closeModal('passkeySetupModal');
            showNoticeModal('Passkey Registration Error', err.message || 'Passkey setup was canceled or failed.');
        }
    };

    // Logout
    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('hellomail_token');
        authToken = null;
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
    };

    // Create Alias Form Handler
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
            showNoticeModal('Alias Creation Error', 'Failed to create alias.');
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

    if (!res.ok) return;

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
    const res = await fetch('/api/aliases', {
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

    if (res.ok) {
        loadAliases();
    } else {
        showNoticeModal('Error', 'Failed to delete alias.');
    }
}
