import { DB, initData } from "./data.js";

// UI and Core Logic
let currentAuthTab = 'user'; // 'user' or 'admin'
let dataReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initData();
        dataReady = true;
        const loading = document.getElementById('app-loading');
        if (loading) loading.classList.add('hidden');
        checkSession();
    } catch (err) {
        console.error(err);
        dataReady = false;
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.classList.add('hidden');
        }
        const message = err?.message || 'Unable to load local data.';
        showToast(`Data setup error: ${message}`, 'error');
    }
});

window.onDataChange = () => {
    if (!DB.getSession()) return;
    refreshData();
    const docsPage = document.getElementById('page-documents');
    if (docsPage && !docsPage.classList.contains('hidden')) renderDocuments();
    const adminPage = document.getElementById('page-admin');
    if (adminPage && !adminPage.classList.contains('hidden')) {
        renderUsersTable();
        renderAdminDocs();
        renderStructureLists();
    }
};

function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('show');
}

function closeSidebar() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
}

// --- Toast System ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const iconClass = icons[type] || 'fa-check-circle';
    toast.innerHTML = `
        <i class="fas ${iconClass} toast-icon"></i>
        <span class="toast-msg">${message}</span>
        <button class="toast-close-btn" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}

// --- Modals ---
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// --- Authentication UI ---
function switchAuthTab(tab) {
    currentAuthTab = tab;
    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('login-password').value = '';
// Removed admin notice logic
    const errorBox = document.getElementById('auth-error');
    errorBox.classList.add('hidden');

    if (tab === 'admin') {
        document.getElementById('login-username').value = 'admin'; // auto-fill for demo
        document.getElementById('login-username').disabled = true;
    } else {
        document.getElementById('login-username').value = '';
        document.getElementById('login-username').disabled = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;
    const errorBox = document.getElementById('auth-error');
    errorBox.classList.add('hidden');

    if (!dataReady) {
        errorBox.textContent = 'Local data is not ready. Refresh this page and try again.';
        errorBox.classList.remove('hidden');
        return;
    }

    try {
        if (currentAuthTab === 'admin') {
            const ok = await DB.verifyAdminPassword(pass);
            if (!ok) {
                errorBox.textContent = 'Incorrect admin password.';
                errorBox.classList.remove('hidden');
                return;
            }
            DB.setSession({ role: 'admin', username: 'admin' });
            showToast('Admin login successful');
            routeToApp();
            if (DB.getAdmin()?.mustChangePassword) {
                showToast('Please change the default admin password in Security.', 'info');
            }
        } else {
            if (!user || !pass) {
                errorBox.textContent = 'Please enter credentials.';
                errorBox.classList.remove('hidden');
                return;
            }
            const account = await DB.verifyUserPassword(user, pass);
            if (!account) {
                errorBox.textContent = 'Incorrect username or password. Ask an admin to create your account.';
                errorBox.classList.remove('hidden');
                return;
            }
            DB.setSession({ role: account.role || 'user', username: account.username, userId: account.id });
            showToast(`Welcome back, ${account.username}!`);
            routeToApp();
        }
    } catch (err) {
        errorBox.textContent = err.message || 'Login failed.';
        errorBox.classList.remove('hidden');
    }
}

function handleLogout() {
    DB.setSession(null);
    closeSidebar();
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('auth-view').classList.add('active');
}

function checkSession() {
    const session = DB.getSession();
    if (session) {
        routeToApp();
    }
}

function routeToApp() {
    const session = DB.getSession();
    if (!session) return;

    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    document.getElementById('current-username').textContent = session.username;
    document.getElementById('dash-username').textContent = session.username;

    // Handle Admin UI restrictions
    if (session.role === 'admin') {
        document.getElementById('nav-admin').classList.remove('hidden');
        renderStructureLists();
    } else {
        document.getElementById('nav-admin').classList.add('hidden');
    }

    navigateTo(session.role === 'admin' ? 'admin' : 'dashboard');
    refreshData();
    if (session.role === 'admin') renderUsersTable();
}

// --- Navigation ---
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Activate specific page
    const tgtPage = document.getElementById(`page-${pageId}`);
    if(tgtPage) {
        tgtPage.classList.remove('hidden');
        tgtPage.classList.add('active');
    }

    // Activate nav item based on function context
    const navItemEvents = event ? [event.currentTarget] : [];
    if(navItemEvents.length > 0 && navItemEvents[0].classList.contains('nav-item')) {
        navItemEvents[0].classList.add('active');
    } else {
        // Fallback search
        document.querySelectorAll('.nav-item').forEach(item => {
            if(item.innerHTML.includes(pageId === 'admin' ? 'Admin Panel' : capitalize(pageId))) {
                item.classList.add('active');
            }
        });
    }
    
    closeSidebar();
    if(pageId === 'documents') {
        initUserFilters();
        renderDocuments();
    }
    if(pageId === 'admin') {
        renderUsersTable();
    }
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

// --- Render Content ---
function refreshData() {
    const docs = DB.getDocs();
    document.getElementById('stat-total-docs').textContent = docs.length;
    
    const recentList = document.getElementById('recent-docs-list');
    const emptyState = document.getElementById('recent-docs-empty');
    recentList.innerHTML = '';
    
    if (docs.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        docs.slice(0, 3).forEach(doc => {
            recentList.innerHTML += `
                <div class="doc-item-list" onclick="previewDoc('${doc.id}')" style="cursor:pointer;">
                    <div class="doc-info">
                        <i class="fas fa-file-${doc.type === 'pdf' ? 'pdf' : (doc.type==='doc'?'word':'alt')} doc-icon"></i>
                        <div>
                            <h4 style="font-size:0.9rem; margin-bottom:2px;">${doc.name}</h4>
                            <span class="doc-meta">${doc.date} &bull; ${doc.size}</span>
                        </div>
                    </div>
                </div>`;
        });
    }
}

function generateDocCardMarkup(doc, role) {
    let hierarchyStr = '';
    if (doc.collegeId) {
        const colleges = DB.getColleges();
        const branches = DB.getBranches();
        const sections = DB.getSections();
        const cName = (colleges.find(c => c.id === doc.collegeId) || {}).name || doc.collegeId;
        const bName = (branches.find(b => b.id === doc.branchId) || {}).name || doc.branchId;
        let sName = doc.sectionId === 'all' ? 'All Sections' : ((sections.find(s => s.id === doc.sectionId) || {}).name || doc.sectionId);
        hierarchyStr = `<br><small class="text-muted"><i class="fas fa-university"></i> ${cName} &bull; ${bName} &bull; ${sName}</small>`;
    } else if (doc.branchId) {
        hierarchyStr = `<br><small class="text-muted"><i class="fas fa-code-branch"></i> Branch ${doc.branchId} &bull; Sec ${doc.sectionId}</small>`;
    }
    
    return `
        <div class="doc-card glass-panel" onclick="previewDoc('${doc.id}')">
            <i class="fas fa-file-${doc.type === 'pdf' ? 'pdf' : (doc.type==='doc'?'word':'alt')} doc-icon"></i>
            <h4>${doc.name}</h4>
            <span class="doc-meta">${doc.size}${hierarchyStr}</span>
            <div class="doc-actions">
                ${ role === 'admin' ? `<button class="icon-btn" style="background:#ff4b4b" onclick="deleteDoc(event, '${doc.id}')"><i class="fas fa-trash"></i></button>` : `<button class="icon-btn"><i class="fas fa-download"></i></button>` }
            </div>
        </div>`;
}

function renderDocuments() {
    const container = document.getElementById('documents-container');
    const session = DB.getSession();
    
    const cId = document.getElementById('user-filter-college')?.value || 'all';
    const bId = document.getElementById('user-filter-branch')?.value || 'all';
    const sId = document.getElementById('user-filter-section')?.value || 'all';
    
    let docs = DB.getDocs();
    if (cId !== 'all') docs = docs.filter(d => d.collegeId === cId);
    if (bId !== 'all') docs = docs.filter(d => d.branchId === bId);
    if (sId !== 'all') docs = docs.filter(d => d.sectionId === sId || d.sectionId === 'all');
    
    container.innerHTML = '';
    if(docs.length === 0) {
        container.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 2rem;">No documents found matching the filters.</div>`;
        return;
    }
    
    docs.forEach(doc => {
        container.innerHTML += generateDocCardMarkup(doc, session.role);
    });
}

function initUserFilters() {
    const colleges = DB.getColleges();
    const collegeSelect = document.getElementById('user-filter-college');
    if (!collegeSelect) return;
    
    const currentVal = collegeSelect.value;
    
    collegeSelect.innerHTML = '<option value="all">All Colleges</option>';
    colleges.forEach(c => {
        collegeSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    if (currentVal && Array.from(collegeSelect.options).some(o => o.value === currentVal)) {
        collegeSelect.value = currentVal;
    }
    renderUserFilterBranchSelect();
}

function renderUserFilterBranchSelect() {
    const cId = document.getElementById('user-filter-college').value;
    const branchSelect = document.getElementById('user-filter-branch');
    const currentVal = branchSelect.value;
    
    branchSelect.innerHTML = '<option value="all">All Branches</option>';
    
    if (cId !== 'all') {
        const branches = DB.getBranches().filter(b => b.collegeId === cId);
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
    
    if (currentVal && Array.from(branchSelect.options).some(o => o.value === currentVal)) {
        branchSelect.value = currentVal;
    }
    renderUserFilterSectionSelect();
}

function renderUserFilterSectionSelect() {
    const bId = document.getElementById('user-filter-branch').value;
    const sectionSelect = document.getElementById('user-filter-section');
    const currentVal = sectionSelect.value;
    
    sectionSelect.innerHTML = '<option value="all">All Sections</option>';
    
    if (bId !== 'all') {
        const sections = DB.getSections().filter(s => s.branchId === bId);
        sections.forEach(s => {
            sectionSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
    
    if (currentVal && Array.from(sectionSelect.options).some(o => o.value === currentVal)) {
        sectionSelect.value = currentVal;
    }
    renderDocuments();
}

function initAdminFilters() {
    const colleges = DB.getColleges();
    const collegeSelect = document.getElementById('filter-college');
    if (!collegeSelect) return;
    
    // Remember current selection to avoid resetting if not needed
    const currentVal = collegeSelect.value;
    
    collegeSelect.innerHTML = '<option value="all">All Colleges</option>';
    colleges.forEach(c => {
        collegeSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    if (currentVal && Array.from(collegeSelect.options).some(o => o.value === currentVal)) {
        collegeSelect.value = currentVal;
    }
    renderFilterBranchSelect();
}

function renderFilterBranchSelect() {
    const cId = document.getElementById('filter-college').value;
    const branchSelect = document.getElementById('filter-branch');
    const currentVal = branchSelect.value;
    
    branchSelect.innerHTML = '<option value="all">All Branches</option>';
    
    if (cId !== 'all') {
        const branches = DB.getBranches().filter(b => b.collegeId === cId);
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
    
    if (currentVal && Array.from(branchSelect.options).some(o => o.value === currentVal)) {
        branchSelect.value = currentVal;
    }
    renderFilterSectionSelect();
}

function renderFilterSectionSelect() {
    const bId = document.getElementById('filter-branch').value;
    const sectionSelect = document.getElementById('filter-section');
    const currentVal = sectionSelect.value;
    
    sectionSelect.innerHTML = '<option value="all">All Sections</option>';
    
    if (bId !== 'all') {
        const sections = DB.getSections().filter(s => s.branchId === bId);
        sections.forEach(s => {
            sectionSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
    
    if (currentVal && Array.from(sectionSelect.options).some(o => o.value === currentVal)) {
        sectionSelect.value = currentVal;
    }
    renderAdminDocs();
}

function renderAdminDocs() {
    const adminContainer = document.getElementById('admin-docs-container');
    if(!adminContainer) return;
    
    const cId = document.getElementById('filter-college')?.value || 'all';
    const bId = document.getElementById('filter-branch')?.value || 'all';
    const sId = document.getElementById('filter-section')?.value || 'all';
    
    let docs = DB.getDocs();
    if (cId !== 'all') docs = docs.filter(d => d.collegeId === cId);
    if (bId !== 'all') docs = docs.filter(d => d.branchId === bId);
    if (sId !== 'all') docs = docs.filter(d => d.sectionId === sId || d.sectionId === 'all');
    
    adminContainer.innerHTML = '';
    if(docs.length === 0) {
        adminContainer.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 2rem;">No documents match the selected filters.</div>`;
        return;
    }
    
    docs.forEach(doc => {
        adminContainer.innerHTML += generateDocCardMarkup(doc, 'admin');
    });
}

async function deleteDoc(e, id) {
    e.stopPropagation();
    if(confirm('Are you sure you want to delete this document?')) {
        try {
            await DB.deleteDoc(id);
            renderDocuments();
            renderAdminDocs();
            refreshData();
            showToast('Document deleted');
        } catch (err) {
            showToast(err.message || 'Could not delete document.', 'error');
        }
    }
}

// --- Mock Document Actions ---
function previewDoc(id) {
    const doc = DB.getDocs().find(d => d.id === id);
    if(!doc) return;
    
    document.getElementById('modal-doc-title').textContent = doc.name;
    
    let contentHtml = '';
    if (doc.content) {
        if (doc.type === 'pdf') {
            contentHtml = `<iframe src="${doc.content}" width="100%" height="500px" style="border:none; border-radius: 8px;"></iframe>`;
        } else if (['png', 'jpg', 'jpeg', 'gif'].includes(doc.type)) {
            contentHtml = `<img src="${doc.content}" style="max-width: 100%; max-height: 500px; border-radius: 8px; display: block; margin: 0 auto;" alt="${doc.name}" />`;
        } else if (doc.type === 'txt') {
            contentHtml = `<iframe src="${doc.content}" width="100%" height="500px" style="border:none; background: #fff; border-radius: 8px; color: #000;"></iframe>`;
        } else {
            contentHtml = `
                <div style="text-align:center; padding: 2rem;">
                    <i class="fas fa-file-alt" style="font-size: 4rem; color: var(--primary-light); margin-bottom: 1rem;"></i>
                    <h3>File ready for download</h3>
                    <p class="text-muted mt-4">Filename: ${doc.name}</p>
                    <p class="text-muted">Preview is not natively supported for this format in the browser.</p>
                </div>
            `;
        }
    } else {
        contentHtml = `
            <div style="text-align:center; padding: 2rem;">
                <i class="fas fa-file-${doc.type === 'pdf' ? 'pdf' : 'alt'}" style="font-size: 4rem; color: var(--primary-light); margin-bottom: 1rem;"></i>
                <h3>Mock File Preview</h3>
                <p class="text-muted mt-4">Filename: ${doc.name}</p>
                <p class="text-muted">Size: ${doc.size}</p>
                <p class="text-muted">In a real app, the PDF/DOC content would be rendered here via Canvas or an iframe.</p>
            </div>
        `;
    }

    document.getElementById('modal-doc-body').innerHTML = contentHtml;
    openModal('doc-modal');
}

function openAIToolsFromModal() {
    closeModal('doc-modal');
    navigateTo('ai-tools');
    showToast('Sent to AI Summarizer');
}

// --- Admin Logic ---
function switchAdminTab(tab) {
    // Sync select dropdown in case function is called directly
    const selectEl = document.getElementById('admin-task-select');
    if (selectEl && selectEl.value !== tab) {
        selectEl.value = tab;
    }
    
    document.querySelectorAll('.admin-view').forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
    });
    
    const targetView = document.getElementById(`admin-${tab}-view`);
    if(targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }
    
    if(tab === 'docs') {
        initAdminFilters();
    }
    if(tab === 'structure') {
        renderStructureLists();
    }
    if(tab === 'users') {
        renderUsersTable();
    }
}

async function handleAdminPasswordChange(e) {
    e.preventDefault();
    const current = document.getElementById('current-admin-pass').value;
    const newPass = document.getElementById('new-admin-pass').value;
    const confirmPass = document.getElementById('confirm-admin-pass').value;
    const msgBox = document.getElementById('pass-change-msg');
    const session = DB.getSession();

    msgBox.className = 'mt-4';
    if (!session || session.role !== 'admin') {
        msgBox.innerHTML = '<span class="error-text d-block">Only a signed-in admin can change this password.</span>';
        return;
    }
    if (newPass !== confirmPass) {
        msgBox.innerHTML = '<span class="error-text d-block">New passwords do not match.</span>';
        return;
    }
    try {
        await DB.setAdminPass(current, newPass);
        msgBox.innerHTML = '<span class="success-text d-block">Admin password updated. It is stored as a hash, not plain text.</span>';
        document.getElementById('admin-password-form').reset();
        showToast('Admin password changed');
    } catch (err) {
        msgBox.innerHTML = `<span class="error-text d-block">${err.message}</span>`;
    }
}

function renderUsersTable() {
    const body = document.getElementById('users-table-body');
    if (!body) return;
    const users = DB.getUsers();
    if (users.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="text-muted">No users yet. Create an account below.</td></tr>`;
        return;
    }
    body.innerHTML = users.map((u) => `
        <tr>
            <td>${u.username}${u.banned ? ' <span class="text-muted">(banned)</span>' : ''}</td>
            <td>${u.role || 'user'}</td>
            <td>${u.docsCount || 0}</td>
            <td class="table-actions">
                <button class="btn btn-small btn-outline" onclick="openResetUserPassword('${u.id}')">Reset password</button>
                <button class="btn btn-small btn-outline" onclick="toggleUserBan('${u.id}', ${u.banned ? 'false' : 'true'})">${u.banned ? 'Unban' : 'Ban'}</button>
            </td>
        </tr>
    `).join('');
}

async function handleCreateUser(e) {
    e.preventDefault();
    const session = DB.getSession();
    if (!session || session.role !== 'admin') {
        showToast('Only admin can create users.', 'error');
        return;
    }
    const username = document.getElementById('new-user-username').value;
    const password = document.getElementById('new-user-password').value;
    try {
        await DB.addUser({ username, password, role: 'user' });
        document.getElementById('create-user-form').reset();
        renderUsersTable();
        showToast('User created');
    } catch (err) {
        showToast(err.message || 'Could not create user.', 'error');
    }
}

async function openResetUserPassword(userId) {
    const session = DB.getSession();
    if (!session || session.role !== 'admin') {
        showToast('Only admin can reset passwords.', 'error');
        return;
    }
    const next = prompt('Enter a new password for this user (min 8 characters):');
    if (!next) return;
    try {
        await DB.resetUserPassword(userId, next);
        showToast('User password updated');
    } catch (err) {
        showToast(err.message || 'Could not reset password.', 'error');
    }
}

async function toggleUserBan(userId, banned) {
    const session = DB.getSession();
    if (!session || session.role !== 'admin') {
        showToast('Only admin can change user status.', 'error');
        return;
    }
    try {
        await DB.setUserBanned(userId, banned === true || banned === 'true');
        renderUsersTable();
        showToast(banned ? 'User banned' : 'User unbanned');
    } catch (err) {
        showToast(err.message || 'Could not update user.', 'error');
    }
}

function renderStructureLists() {
    const sections = DB.getSections();
    const branches = DB.getBranches();
    const colleges = DB.getColleges();

    // Populate upload form selects
    const uploadCollegeSel = document.getElementById('upload-college-select');
    if (uploadCollegeSel) {
        const v = uploadCollegeSel.value;
        uploadCollegeSel.innerHTML = '<option value="">Choose College...</option>';
        colleges.forEach(c => uploadCollegeSel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        uploadCollegeSel.value = v || '';
    }
    renderUploadBranchSelect();

    // Populate stepper selects
    const stepBranchCol = document.getElementById('stepper-branch-college');
    if (stepBranchCol) {
        const v = stepBranchCol.value;
        stepBranchCol.innerHTML = '<option value="">Choose College...</option>';
        colleges.forEach(c => stepBranchCol.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        if (v) stepBranchCol.value = v;
    }

    const stepSecCol = document.getElementById('stepper-section-college');
    if (stepSecCol) {
        const v = stepSecCol.value;
        stepSecCol.innerHTML = '<option value="">Choose College...</option>';
        colleges.forEach(c => stepSecCol.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        if (v) stepSecCol.value = v;
    }

    renderTreeView();
    updateStepperLockState();
}

function renderUploadBranchSelect() {
    const collegeId = document.getElementById('upload-college-select')?.value;
    const branchSelect = document.getElementById('upload-branch-select');
    if(!branchSelect) return;
    
    branchSelect.innerHTML = '<option value="">Choose Branch...</option>';
    if(collegeId) {
        const branches = DB.getBranches().filter(b => b.collegeId === collegeId);
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
    renderUploadSectionSelect();
}

function renderSectionBranchSelect() {
    const collegeId = document.getElementById('section-college-select')?.value;
    const branchSelect = document.getElementById('section-branch-select');
    if(!branchSelect) return;
    
    branchSelect.innerHTML = '<option value="">Choose Branch...</option>';
    if(collegeId) {
        const branches = DB.getBranches().filter(b => b.collegeId === collegeId);
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
}

function renderUploadSectionSelect() {
    const branchId = document.getElementById('upload-branch-select')?.value;
    const sectionSelect = document.getElementById('upload-section-select');
    if(!sectionSelect) return;
    
    sectionSelect.innerHTML = '<option value="">Choose Section...</option>';
    if(branchId) {
        const sections = DB.getSections().filter(s => s.branchId === branchId);
        sections.forEach(s => {
            sectionSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
}

function toggleUploadSectionSelect() {
    const allCheckbox = document.getElementById('upload-all-sections');
    const sectionSelect = document.getElementById('upload-section-select');
    if(allCheckbox && sectionSelect) {
        sectionSelect.disabled = allCheckbox.checked;
        if(allCheckbox.checked) {
            sectionSelect.value = '';
        }
    }
}

async function handleCreateSection(e) {
    e.preventDefault();
    const branchId = document.getElementById('section-branch-select').value;
    const input = document.getElementById('new-section-name');
    if(input.value.trim() && branchId) {
        await DB.addSection({ id: 'sec_' + Date.now(), branchId: branchId, name: input.value.trim() });
        input.value = '';
        renderStructureLists();
        showToast('Section created successfully');
    } else {
        showToast('Please provide a name and select a branch.', 'error');
    }
}

async function handleAdminUpload(e) {
    e.preventDefault();
    const collegeId = document.getElementById('upload-college-select').value;
    const branchId = document.getElementById('upload-branch-select').value;
    let sectionId = document.getElementById('upload-section-select').value;
    const allSections = document.getElementById('upload-all-sections').checked;
    const fileInput = document.getElementById('admin-file-upload');
    const file = fileInput.files[0];
    
    if(allSections) {
        sectionId = 'all';
    }
    
    if(!collegeId || !branchId || (!sectionId && !allSections) || !file) {
        showToast('Please fill all required fields.', 'error');
        return;
    }
    
    const ext = file.name.split('.').pop().toLowerCase();
    const newDoc = {
        id: 'doc_' + Date.now(),
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        date: new Date().toISOString().split('T')[0],
        type: ['pdf','doc','docx','txt', 'png', 'jpg', 'jpeg', 'gif'].includes(ext) ? ext : 'alt',
        uploader: DB.getSession().username,
        collegeId: collegeId,
        branchId: branchId,
        sectionId: sectionId
    };

    try {
        await DB.addDoc(newDoc, file);
        showToast(`Uploaded ${file.name} to section${allSections ? 's' : ''}`);
        fileInput.value = '';
        renderDocuments();
        renderAdminDocs();
        refreshData();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to save the selected file.', 'error');
    }
}

async function handleCreateBranch(e) {
    e.preventDefault();
    const collegeId = document.getElementById('branch-college-select').value;
    const input = document.getElementById('new-branch-name');
    if(input.value.trim() && collegeId) {
        await DB.addBranch({ id: 'br_' + Date.now(), collegeId: collegeId, name: input.value.trim() });
        input.value = '';
        renderStructureLists();
        showToast('Branch created successfully');
    } else {
        showToast('Please provide a name and select a college.', 'error');
    }
}

async function handleCreateCollege(e) {
    e.preventDefault();
    const input = document.getElementById('new-college-name');
    if(input.value.trim()) {
        await DB.addCollege({ id: 'col_' + Date.now(), name: input.value.trim() });
        input.value = '';
        renderStructureLists();
        showToast('College created successfully');
    }
}

async function deleteSection(id) {
    if(confirm('Delete this section?')) {
        await DB.deleteSection(id);
        renderStructureLists();
        showToast('Section deleted');
    }
}

async function deleteBranch(id) {
    if(confirm('Delete this branch?')) {
        await DB.deleteBranch(id);
        renderStructureLists();
        showToast('Branch deleted');
    }
}

async function deleteCollege(id) {
    if(confirm('Delete this college?')) {
        await DB.deleteCollege(id);
        renderStructureLists();
        showToast('College deleted');
    }
}

// ============================================================
// TREE VIEW RENDERER
// ============================================================
function renderTreeView() {
    const tree = document.getElementById('structure-tree');
    if (!tree) return;

    const colleges = DB.getColleges();
    const branches = DB.getBranches();
    const sections = DB.getSections();

    // Update stat badges
    const countsEl = document.getElementById('tree-counts');
    if (countsEl) {
        countsEl.innerHTML = `
            <span class="tree-stat-badge"><i class="fas fa-university"></i> ${colleges.length} College${colleges.length !== 1 ? 's' : ''}</span>
            <span class="tree-stat-badge"><i class="fas fa-code-branch"></i> ${branches.length} Branch${branches.length !== 1 ? 'es' : ''}</span>
            <span class="tree-stat-badge"><i class="fas fa-layer-group"></i> ${sections.length} Section${sections.length !== 1 ? 's' : ''}</span>
        `;
    }

    if (colleges.length === 0) {
        tree.innerHTML = `
            <div class="tree-empty">
                <i class="fas fa-sitemap"></i>
                <p>No structure created yet.</p>
                <p style="font-size:0.82rem; opacity:0.6;">Use the wizard on the left to add your first college.</p>
            </div>`;
        return;
    }

    tree.innerHTML = colleges.map(college => {
        const collegeBranches = branches.filter(b => b.collegeId === college.id);
        const totalSecs = collegeBranches.reduce((acc, b) => acc + sections.filter(s => s.branchId === b.id).length, 0);
        const colId = `col-children-${college.id}`;

        const branchesHTML = collegeBranches.length === 0
            ? `<div style="padding: 8px 16px 14px; font-size:0.8rem; color:var(--text-muted); opacity:0.5;">No branches yet.</div>`
            : collegeBranches.map(branch => {
                const branchSecs = sections.filter(s => s.branchId === branch.id);
                const brId = `br-secs-${branch.id}`;
                const secsHTML = branchSecs.length === 0
                    ? `<p class="tree-no-sections">No sections yet.</p>`
                    : branchSecs.map(sec => `
                        <div class="tree-section-row">
                            <span class="tree-section-name"><i class="fas fa-circle"></i>${sec.name}</span>
                            <div class="tree-section-actions">
                                <button class="tree-del" onclick="deleteSection('${sec.id}')" title="Delete section"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`).join('');
                return `
                <div class="tree-branch">
                    <div class="tree-branch-header" onclick="toggleTreeNode('${brId}', this)">
                        <div class="tree-branch-title">
                            <div class="tree-icon-branch"><i class="fas fa-code-branch"></i></div>
                            <span class="tree-branch-name">${branch.name}</span>
                            <span class="tree-badge">${branchSecs.length} sec</span>
                        </div>
                        <div class="tree-branch-actions">
                            <button class="tree-del" onclick="event.stopPropagation(); deleteBranch('${branch.id}')" title="Delete branch"><i class="fas fa-trash"></i></button>
                            <button class="tree-toggle open" id="tog-${brId}"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div class="tree-sections" id="${brId}">${secsHTML}</div>
                </div>`;
            }).join('');

        return `
        <div class="tree-college">
            <div class="tree-college-header" onclick="toggleTreeNode('${colId}', this)">
                <div class="tree-college-title">
                    <div class="tree-icon-college"><i class="fas fa-university"></i></div>
                    <span class="tree-college-name">${college.name}</span>
                    <span class="tree-badge">${collegeBranches.length} branch${collegeBranches.length !== 1 ? 'es' : ''}</span>
                    <span class="tree-badge">${totalSecs} section${totalSecs !== 1 ? 's' : ''}</span>
                </div>
                <div class="tree-college-actions">
                    <button class="tree-del" onclick="event.stopPropagation(); deleteCollege('${college.id}')" title="Delete college"><i class="fas fa-trash"></i></button>
                    <button class="tree-toggle open" id="tog-${colId}"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="tree-children" id="${colId}">${branchesHTML}</div>
        </div>`;
    }).join('');
}

function toggleTreeNode(childId, headerEl) {
    const children = document.getElementById(childId);
    const toggleBtn = headerEl.querySelector('.tree-toggle') || document.getElementById(`tog-${childId}`);
    if (!children) return;
    const isHidden = children.classList.toggle('hidden-tree');
    if (toggleBtn) toggleBtn.classList.toggle('open', !isHidden);
}

// ============================================================
// STEPPER LOGIC
// ============================================================
let stepperUnlockedUpto = 1; // 1 = only step1 unlocked, 2 = up to step2, 3 = all

function updateStepperLockState() {
    const colleges = DB.getColleges();
    const branches = DB.getBranches();
    const maxUnlocked = colleges.length > 0 ? (branches.length > 0 ? 3 : 2) : 1;
    if (maxUnlocked > stepperUnlockedUpto) stepperUnlockedUpto = maxUnlocked;

    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (!stepEl) continue;
        if (i <= stepperUnlockedUpto) {
            stepEl.classList.remove('locked');
        } else {
            stepEl.classList.add('locked');
            stepEl.classList.remove('active', 'completed');
        }
    }
}

function activateStep(num) {
    if (num > stepperUnlockedUpto) return; // still locked
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        const content = document.getElementById(`step-content-${i}`);
        if (!stepEl) continue;
        if (i === num) {
            if (!stepEl.classList.contains('locked')) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed');
                if (content) content.classList.remove('hidden');
            }
        } else {
            stepEl.classList.remove('active');
            if (content) content.classList.add('hidden');
        }
    }
}

function markStepComplete(num) {
    const stepEl = document.getElementById(`step-${num}`);
    if (!stepEl) return;
    stepEl.classList.remove('active', 'locked');
    stepEl.classList.add('completed');
    const content = document.getElementById(`step-content-${num}`);
    if (content) content.classList.add('hidden');
}

function resetStepper() {
    stepperUnlockedUpto = 1;
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        const content = document.getElementById(`step-content-${i}`);
        if (!stepEl) continue;
        stepEl.classList.remove('active', 'completed', 'locked');
        if (i === 1) {
            stepEl.classList.add('active');
            if (content) content.classList.remove('hidden');
        } else {
            stepEl.classList.add('locked');
            if (content) content.classList.add('hidden');
        }
    }
    // clear inputs and reset buttons
    ['stepper-college-name', 'stepper-branch-name', 'stepper-section-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['btn-college', 'btn-branch', 'btn-section'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = true;
    });
    ['err-college', 'err-branch', 'err-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    updateStepperLockState();
}

// Real-time input validation: enables/disables the action button
function validateStepperInput(inputId, btnId, errId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    const err   = document.getElementById(errId);
    if (!input || !btn) return;
    const hasValue = input.value.trim().length > 0;
    btn.disabled = !hasValue;
    if (hasValue && err) err.classList.add('hidden');
}

function showStepperError(errId, btnId) {
    const err = document.getElementById(errId);
    const btn = document.getElementById(btnId);
    if (err) err.classList.remove('hidden');
    if (btn) {
        btn.classList.remove('shake');
        void btn.offsetWidth; // force reflow to restart animation
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 500);
    }
    // Flash the input red briefly
    const inputMap = { 'err-college': 'stepper-college-name', 'err-branch': 'stepper-branch-name', 'err-section': 'stepper-section-name' };
    const inputEl = document.getElementById(inputMap[errId]);
    if (inputEl) {
        inputEl.classList.add('input-error');
        inputEl.focus();
        setTimeout(() => inputEl.classList.remove('input-error'), 1500);
    }
}

async function stepperAddCollege() {
    const input = document.getElementById('stepper-college-name');
    if (!input || !input.value.trim()) {
        showStepperError('err-college', 'btn-college');
        showToast('Please enter a college name.', 'error');
        return;
    }
    await DB.addCollege({ id: 'col_' + Date.now(), name: input.value.trim() });
    showToast('College added successfully! ✔', 'success');
    input.value = '';
    // Reset button after clearing input
    const btn = document.getElementById('btn-college');
    if (btn) btn.disabled = true;
    stepperUnlockedUpto = Math.max(stepperUnlockedUpto, 2);
    markStepComplete(1);
    renderStructureLists();
    const step2 = document.getElementById('step-2');
    if (step2) { step2.classList.remove('locked', 'completed'); }
    activateStep(2);
}

async function stepperAddBranch() {
    const colSel = document.getElementById('stepper-branch-college');
    const input  = document.getElementById('stepper-branch-name');
    if (!colSel || !colSel.value) {
        showToast('Please select a college first.', 'error'); return;
    }
    if (!input || !input.value.trim()) {
        showStepperError('err-branch', 'btn-branch');
        showToast('Please enter a branch name.', 'error');
        return;
    }
    await DB.addBranch({ id: 'br_' + Date.now(), collegeId: colSel.value, name: input.value.trim() });
    showToast('Branch added successfully! ✔', 'success');
    input.value = '';
    const btn = document.getElementById('btn-branch');
    if (btn) btn.disabled = true;
    stepperUnlockedUpto = Math.max(stepperUnlockedUpto, 3);
    markStepComplete(2);
    renderStructureLists();
    const step3 = document.getElementById('step-3');
    if (step3) { step3.classList.remove('locked', 'completed'); }
    activateStep(3);
    const secCol = document.getElementById('stepper-section-college');
    if (secCol) { secCol.value = colSel.value; stepperSectionCollegeChange(); }
}

async function stepperAddSection() {
    const colSel = document.getElementById('stepper-section-college');
    const brSel  = document.getElementById('stepper-section-branch');
    const input  = document.getElementById('stepper-section-name');
    if (!colSel || !colSel.value) {
        showToast('Please select a college.', 'error'); return;
    }
    if (!brSel || !brSel.value) {
        showToast('Please select a branch.', 'error'); return;
    }
    if (!input || !input.value.trim()) {
        showStepperError('err-section', 'btn-section');
        showToast('Please enter a section name.', 'error');
        return;
    }
    await DB.addSection({ id: 'sec_' + Date.now(), branchId: brSel.value, name: input.value.trim() });
    showToast('Section added successfully! ✔', 'success');
    input.value = '';
    const btn = document.getElementById('btn-section');
    if (btn) btn.disabled = true;
    markStepComplete(3);
    renderStructureLists();
    // Allow adding more sections — re-open step 3 after short delay
    setTimeout(() => {
        const step3 = document.getElementById('step-3');
        if (step3) { step3.classList.remove('completed'); step3.classList.add('active'); }
        const content3 = document.getElementById('step-content-3');
        if (content3) content3.classList.remove('hidden');
    }, 600);
}

function stepperSectionCollegeChange() {
    const colSel = document.getElementById('stepper-section-college');
    const brSel = document.getElementById('stepper-section-branch');
    if (!brSel) return;
    brSel.innerHTML = '<option value="">Choose Branch...</option>';
    if (colSel && colSel.value) {
        DB.getBranches().filter(b => b.collegeId === colSel.value).forEach(b => {
            brSel.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
}

// --- AI Chat Logic ---
let currentAITool = 'summarize';

function setAITool(toolType, e) {
    currentAITool = toolType;
    document.querySelectorAll('#ai-tools-sidebar .tool-btn').forEach(btn => btn.classList.remove('active'));
    if(e && e.currentTarget) {
        e.currentTarget.classList.add('active');
    }
    
    // Auto-prompt based on tool
    const msgs = {
        'summarize': 'Sure, what document would you like me to summarize?',
        'qa': 'I am ready. Ask me anything about your documents!',
        'flashcards': 'I can generate flashcards from your text. Paste some text or choose a doc.',
        'extract': 'I will extract the key bullet points for you.'
    };
    addAIMessage(msgs[toolType], 'system');
}

function handleAIKeyPress(e) {
    if (e.key === 'Enter') {
        handleAISend();
    }
}

function handleAISend() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    // Add user message
    addAIMessage(msg, 'user');
    input.value = '';
    
    // Mock fast realtime response
    setTimeout(() => {
        generateSmartResponse(msg);
    }, 400); // Super fast context processing simulation
}

function addAIMessage(text, type) {
    const chatBox = document.getElementById('ai-chat-box');
    const isUser = type === 'user';
    const msgHTML = `
        <div class="ai-message ${type}">
            <div class="avatar"><i class="fas fa-${isUser ? 'user-astronaut' : 'robot'}"></i></div>
            <div class="msg-content">${text}</div>
        </div>
    `;
    chatBox.insertAdjacentHTML('beforeend', msgHTML);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Apply animation classes based on CSS
    const newMsg = chatBox.lastElementChild;
    newMsg.style.animation = 'none';
    setTimeout(() => { newMsg.style.animation = 'fadeScaleUp 0.3s ease-out'; }, 10);
}

function generateSmartResponse(userText) {
    let response = "I couldn't quite understand that.";
    
    const lowers = userText.toLowerCase();
    
    if (currentAITool === 'summarize') {
        response = `<strong>Quick Summary:</strong><br><br>The document primarily discusses the fundamental concepts of the selected topic. Key takeaways include understanding the core architecture, optimizing for maximum performance, and ensuring a securely robust integration structure.<br><br>Would you like me to go deeper into any specific section?`;
    } else if (currentAITool === 'qa') {
        if (lowers.includes('who') || lowers.includes('what')) {
            response = `Based on the text, the main subject is fundamentally the underlying mechanism that drives the system's efficiency forward.`;
        } else {
            response = `That's an interesting question! According to the selected document, the answer involves leveraging the new framework to considerably reduce latency on all ends.`;
        }
    } else if (currentAITool === 'flashcards') {
        response = `<strong>Generated Flashcards:</strong><br><br>Q: What is the main concept discussed?<br>A: The core framework mechanism.<br><hr>Q: How does the framework improve operational speed?<br>A: By reducing overhead latency.<br><hr>Q: What is absolutely required for setup?<br>A: A secure, valid integration environment.`;
    } else if (currentAITool === 'extract') {
        response = `<strong>Keywords & Entities Extracted:</strong><br><br>&bull; Framework Architecture<br>&bull; Latency Reduction<br>&bull; Core Integrations<br>&bull; System Efficiency<br>&bull; Robust Mechanisms`;
    }
    
    addAIMessage(response, 'system');
}

Object.assign(window, {
    toggleSidebar,
    closeSidebar,
    showToast,
    openModal,
    closeModal,
    switchAuthTab,
    handleLogin,
    handleLogout,
    navigateTo,
    previewDoc,
    deleteDoc,
    openAIToolsFromModal,
    setAITool,
    handleAIKeyPress,
    handleAISend,
    switchAdminTab,
    handleAdminPasswordChange,
    handleCreateUser,
    openResetUserPassword,
    toggleUserBan,
    handleAdminUpload,
    renderUploadBranchSelect,
    renderUploadSectionSelect,
    toggleUploadSectionSelect,
    renderUserFilterBranchSelect,
    renderUserFilterSectionSelect,
    renderDocuments,
    renderFilterBranchSelect,
    renderFilterSectionSelect,
    renderAdminDocs,
    activateStep,
    validateStepperInput,
    stepperAddCollege,
    stepperAddBranch,
    stepperAddSection,
    stepperSectionCollegeChange,
    resetStepper,
    toggleTreeNode,
    deleteSection,
    deleteBranch,
    deleteCollege
});

