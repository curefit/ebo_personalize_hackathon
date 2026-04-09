import crypto from "crypto";

const DEFAULT_ADMIN_USERS = [
  { username: "merch.admin", password: "ebo1234", name: "Merch Admin" },
  { username: "ops.lead", password: "ebo5678", name: "Ops Lead" },
];

const sessions = new Map();

function parseAdminUsers() {
  const configured = process.env.ADMIN_USERS_JSON;
  if (!configured) {
    return DEFAULT_ADMIN_USERS;
  }

  try {
    const parsed = JSON.parse(configured);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ADMIN_USERS;
  } catch {
    return DEFAULT_ADMIN_USERS;
  }
}

const adminUsers = parseAdminUsers();

export function getAdminUsersPreview() {
  return adminUsers.map((user) => ({
    username: user.username,
    password: user.password,
    name: user.name,
  }));
}

export function loginAdmin(username, password) {
  const admin = adminUsers.find((user) => user.username === username && user.password === password);
  if (!admin) {
    return null;
  }

  const token = crypto.randomUUID();
  sessions.set(token, {
    username: admin.username,
    name: admin.name,
    issuedAt: new Date().toISOString(),
  });

  return {
    token,
    admin: sessions.get(token),
  };
}

export function getAdminSession(token) {
  if (!token) {
    return null;
  }

  return sessions.get(token) || null;
}

export function extractAdminToken(request) {
  const header = request.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function requireAdmin(request, response, next) {
  const token = extractAdminToken(request);
  const session = getAdminSession(token);

  if (!session) {
    response.status(401).json({ message: "Admin authentication required." });
    return;
  }

  request.adminSession = session;
  next();
}
