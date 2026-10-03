import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  createSubscription,
  recordLog,
  getAdminMetrics
} from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'docstudio-super-secret-jwt-key-2026';

// Helper to extract JSON body from incoming HTTP request
export async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Guard against huge payload
      if (body.length > 1e6) {
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to authenticate JWT token from request header
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);
    return user || null;
  } catch (err) {
    return null;
  }
}

// JSON response helper
function sendJson(res, statusCode, data) {
  if (res.headersSent) return true;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
  return true;
}

// --------------------------------------------------------------------------
// Main API Router Dispatcher
// --------------------------------------------------------------------------
export async function handleApiRoute(req, res, path) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return true;
  }

  // 1. REGISTER
  if (path === '/api/auth/register' && req.method === 'POST') {
    try {
      const { name, email, password } = await parseJsonBody(req);
      if (!name || !email || !password) {
        return sendJson(res, 400, { error: 'Name, email, and password are required.' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        return sendJson(res, 400, { error: 'An account with this email already exists.' });
      }

      const isSuperAdmin = email.toLowerCase().trim() === 'prince86944@gmail.com';
      const role = isSuperAdmin ? 'admin' : 'user';
      const plan = isSuperAdmin ? 'pro' : 'free';

      const user = await createUser({ name, email, password, role, plan });
      const token = jwt.sign({ id: user._id || user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

      await recordLog({
        userId: user._id || user.id,
        userEmail: user.email,
        action: 'USER_REGISTER',
        details: `User registered: ${name} (${role})`
      });

      return sendJson(res, 201, {
        message: 'Account created successfully!',
        token,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          dailyOperationsUsed: user.dailyOperationsUsed || 0,
          dailyQuota: user.dailyQuota || 5
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 2. LOGIN
  if (path === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Please enter both email and password.' });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return sendJson(res, 401, { error: 'Invalid credentials. User not found.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return sendJson(res, 401, { error: 'Invalid credentials. Incorrect password.' });
      }

      // Guarantee Super Admin role for prince86944@gmail.com
      if (user.email.toLowerCase() === 'prince86944@gmail.com' && user.role !== 'admin') {
        await updateUser(user._id || user.id, { role: 'admin', plan: 'pro' });
        user.role = 'admin';
        user.plan = 'pro';
      }

      const token = jwt.sign({ id: user._id || user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

      await recordLog({
        userId: user._id || user.id,
        userEmail: user.email,
        action: 'USER_LOGIN',
        details: `User logged in from web`
      });

      return sendJson(res, 200, {
        message: 'Login successful!',
        token,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          dailyOperationsUsed: user.dailyOperationsUsed || 0,
          dailyQuota: user.dailyQuota || 5
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 3. GET CURRENT USER (ME)
  if (path === '/api/auth/me' && req.method === 'GET') {
    const user = await authenticateRequest(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Not authenticated' });
    }
    return sendJson(res, 200, {
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        dailyOperationsUsed: user.dailyOperationsUsed || 0,
        dailyQuota: user.dailyQuota || 5
      }
    });
  }

  // 4. UPGRADE SUBSCRIPTION
  if (path === '/api/subscription/upgrade' && req.method === 'POST') {
    const user = await authenticateRequest(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Please log in to upgrade subscription.' });
    }
    try {
      const { plan = 'pro', amount = 299, paymentMethod = 'UPI' } = await parseJsonBody(req);
      const userId = user._id || user.id;

      // Update user plan
      const updated = await updateUser(userId, {
        plan,
        dailyQuota: 9999
      });

      // Record subscription receipt
      const sub = await createSubscription({
        userId,
        userEmail: user.email,
        plan,
        amount,
        paymentMethod
      });

      await recordLog({
        userId,
        userEmail: user.email,
        action: 'USER_UPGRADED_PRO',
        details: `Upgraded to ${plan.toUpperCase()} via ${paymentMethod} (₹${amount})`
      });

      return sendJson(res, 200, {
        message: `Successfully upgraded to DocStudio ${plan.toUpperCase()}!`,
        subscription: sub,
        user: {
          id: updated._id || updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          plan: updated.plan,
          dailyOperationsUsed: updated.dailyOperationsUsed || 0,
          dailyQuota: updated.dailyQuota
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 5. RECORD USAGE & CHECK QUOTA
  if (path === '/api/usage/record' && req.method === 'POST') {
    const user = await authenticateRequest(req);
    const { toolId, filename } = await parseJsonBody(req);

    if (user) {
      const userId = user._id || user.id;
      const isPro = user.plan === 'pro' || user.plan === 'enterprise' || user.role === 'admin';

      if (!isPro && user.dailyOperationsUsed >= (user.dailyQuota || 5)) {
        return sendJson(res, 403, {
          error: 'Daily limit reached! Free accounts are limited to 5 operations per day. Please upgrade to Pro for unlimited processing.',
          quotaExceeded: true
        });
      }

      const updated = await updateUser(userId, {
        dailyOperationsUsed: (user.dailyOperationsUsed || 0) + 1
      });

      await recordLog({
        userId,
        userEmail: user.email,
        action: `TOOL_EXECUTE:${toolId}`,
        toolId,
        details: `Processed: ${filename || 'Document'}`
      });

      return sendJson(res, 200, {
        success: true,
        remainingQuota: isPro ? 'Unlimited' : Math.max(0, 5 - updated.dailyOperationsUsed),
        plan: user.plan
      });
    } else {
      // Guest usage
      return sendJson(res, 200, {
        success: true,
        guest: true
      });
    }
  }

  // 6. ADMIN METRICS
  if (path === '/api/admin/metrics' && req.method === 'GET') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Access denied: Admin credentials required.' });
    }
    const metrics = await getAdminMetrics();
    return sendJson(res, 200, metrics);
  }

  // 7. ADMIN ALL USERS
  if (path === '/api/admin/users' && req.method === 'GET') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Access denied: Admin credentials required.' });
    }
    const users = await getAllUsers();
    return sendJson(res, 200, { users });
  }

  // 8. ADMIN UPDATE USER
  if (path === '/api/admin/update-user' && req.method === 'POST') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Access denied: Admin credentials required.' });
    }
    const { id, plan, role, dailyQuota } = await parseJsonBody(req);
    const updateData = {};
    if (plan) updateData.plan = plan;
    if (role) updateData.role = role;
    if (dailyQuota !== undefined) updateData.dailyQuota = dailyQuota;

    const updated = await updateUser(id, updateData);
    await recordLog({
      userId: user._id || user.id,
      userEmail: user.email,
      action: 'ADMIN_UPDATE_USER',
      details: `Admin updated user ${id} (Plan: ${plan}, Role: ${role})`
    });

    return sendJson(res, 200, { message: 'User updated successfully!', user: updated });
  }

  // 9. ADMIN DELETE USER
  if (path === '/api/admin/delete-user' && req.method === 'DELETE') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Access denied: Admin credentials required.' });
    }
    const { id } = await parseJsonBody(req);
    await deleteUser(id);
    return sendJson(res, 200, { message: 'User deleted successfully.' });
  }

  return sendJson(res, 404, { error: `API endpoint '${path}' not found.` });
}
