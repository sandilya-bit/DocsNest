const STORAGE_KEY = "docsnest_data";
const SESSION_KEY = "docs_session";
const INITIAL_ADMIN_PASSWORD = "CnG001";
const LEGACY_INITIAL_ADMIN_PASSWORD = "DocsNestAdmin1";

const cache = {
    documents: [],
    users: [],
    sections: [],
    branches: [],
    colleges: [],
    admin: null
};

function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

function b64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

async function hashPassword(password, saltB64) {
    const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
        key,
        256
    );
    return { hash: bufToB64(bits), salt: bufToB64(salt) };
}

async function passwordsMatch(password, hash, salt) {
    if (!password || !hash || !salt) return false;
    return (await hashPassword(password, salt)).hash === hash;
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    if (typeof window.onDataChange === "function") window.onDataChange();
}

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved) Object.assign(cache, saved);
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected file."));
        reader.readAsDataURL(file);
    });
}

export async function initData() {
    loadData();
    if (!cache.admin) {
        const credentials = await hashPassword(INITIAL_ADMIN_PASSWORD);
        cache.admin = {
            username: "admin",
            passwordHash: credentials.hash,
            passwordSalt: credentials.salt,
            createdAt: new Date().toISOString(),
            mustChangePassword: true
        };
        saveData();
    } else if (await passwordsMatch(LEGACY_INITIAL_ADMIN_PASSWORD, cache.admin.passwordHash, cache.admin.passwordSalt)) {
        const credentials = await hashPassword(INITIAL_ADMIN_PASSWORD);
        cache.admin = { ...cache.admin, passwordHash: credentials.hash, passwordSalt: credentials.salt };
        saveData();
    }
}

export const DB = {
    getDocs: () => cache.documents.slice(),
    getUsers: () => cache.users.slice(),
    getSections: () => cache.sections.slice(),
    getBranches: () => cache.branches.slice(),
    getColleges: () => cache.colleges.slice(),
    getAdmin: () => cache.admin,

    getSession: () => {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY));
        } catch {
            return null;
        }
    },
    setSession: (sessionData) => {
        if (sessionData) localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        else localStorage.removeItem(SESSION_KEY);
    },

    async verifyAdminPassword(password) {
        return passwordsMatch(password, cache.admin?.passwordHash, cache.admin?.passwordSalt);
    },

    async verifyUserPassword(username, password) {
        const user = cache.users.find((item) => item.username.toLowerCase() === username.toLowerCase());
        if (!user || user.banned) return null;
        return (await passwordsMatch(password, user.passwordHash, user.passwordSalt)) ? user : null;
    },

    async setAdminPass(currentPassword, newPassword) {
        if (!(await DB.verifyAdminPassword(currentPassword))) throw new Error("Current admin password is incorrect.");
        if (!newPassword || newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
        const credentials = await hashPassword(newPassword);
        cache.admin = { ...cache.admin, passwordHash: credentials.hash, passwordSalt: credentials.salt, updatedAt: new Date().toISOString(), mustChangePassword: false };
        saveData();
    },

    async addUser({ username, password, role = "user", collegeId = "" }) {
        const name = (username || "").trim();
        if (!name) throw new Error("Username is required.");
        if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (cache.users.some((user) => user.username.toLowerCase() === name.toLowerCase())) throw new Error("That username already exists.");
        const credentials = await hashPassword(password);
        const record = { id: "u_" + Date.now(), username: name, role, collegeId, passwordHash: credentials.hash, passwordSalt: credentials.salt, docsCount: 0, banned: false, createdAt: new Date().toISOString() };
        cache.users.push(record);
        saveData();
        return record;
    },

    async resetUserPassword(userId, newPassword) {
        const user = cache.users.find((item) => item.id === userId);
        if (!user) throw new Error("User not found.");
        if (!newPassword || newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
        const credentials = await hashPassword(newPassword);
        Object.assign(user, { passwordHash: credentials.hash, passwordSalt: credentials.salt, updatedAt: new Date().toISOString() });
        saveData();
    },

    async setUserBanned(userId, banned) {
        const user = cache.users.find((item) => item.id === userId);
        if (!user) throw new Error("User not found.");
        user.banned = !!banned;
        saveData();
    },

    async addDoc(docRecord, file) {
        const id = docRecord.id || "doc_" + Date.now();
        const content = file ? await readFileAsDataUrl(file) : (docRecord.content || "");
        const record = { ...docRecord, id, content, storagePath: "" };
        const existingIndex = cache.documents.findIndex((doc) => doc.id === id);
        if (existingIndex === -1) cache.documents.push(record);
        else cache.documents[existingIndex] = record;
        saveData();
        return record;
    },

    async deleteDoc(id) {
        cache.documents = cache.documents.filter((doc) => doc.id !== id);
        saveData();
    },

    async addSection(section) {
        cache.sections.push({ ...section, id: section.id || "sec_" + Date.now() });
        saveData();
    },
    async deleteSection(id) {
        cache.sections = cache.sections.filter((section) => section.id !== id);
        saveData();
    },
    async addBranch(branch) {
        cache.branches.push({ ...branch, id: branch.id || "br_" + Date.now() });
        saveData();
    },
    async deleteBranch(id) {
        cache.branches = cache.branches.filter((branch) => branch.id !== id);
        saveData();
    },
    async addCollege(college) {
        cache.colleges.push({ ...college, id: college.id || "col_" + Date.now() });
        saveData();
    },
    async deleteCollege(id) {
        cache.colleges = cache.colleges.filter((college) => college.id !== id);
        saveData();
    }
};

window.DB = DB;
window.initData = initData;
