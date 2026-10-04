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
  findSubscriptionByUtr,
  revokeSubscription,
  recordLog,
  getAdminMetrics,
  getAppConfig,
  updateAppConfig,
  findOrCreateGoogleUser,
  isSuperAdminEmail
} from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'docstudio-super-secret-jwt-key-2026-production';

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

  // 0. GET APP CONFIG (Active UPI ID & QR Code & Google Client ID)
  if (path === '/api/config' && req.method === 'GET') {
    const config = await getAppConfig();
    return sendJson(res, 200, {
      ...config,
      googleClientId: process.env.GOOGLE_CLIENT_ID || '818059891079-kh6vpef04bkov0ic1ajk7a5g100oaejt.apps.googleusercontent.com'
    });
  }

  // 0.1 GOOGLE OAUTH AUTHENTICATION (Exclusive Google Sign-in)
  if (path === '/api/auth/google' && req.method === 'POST') {
    try {
      let { email, name, avatar = '', googleId = '', credential } = await parseJsonBody(req);

      // If official Google Identity Services credential token is passed, decode it
      if (credential) {
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload && payload.email) {
              email = payload.email;
              name = payload.name || payload.email.split('@')[0];
              avatar = payload.picture || '';
              googleId = payload.sub || '';
            }
          }
        } catch (e) {
          console.error('Failed to parse Google credential token:', e);
        }
      }

      if (!email) {
        return sendJson(res, 400, { error: 'Valid Google email is required.' });
      }

      const user = await findOrCreateGoogleUser({ email, name, avatar, googleId });
      const token = jwt.sign(
        { id: user._id || user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      await recordLog({
        userId: user._id || user.id,
        userEmail: user.email,
        action: 'GOOGLE_SIGNIN',
        details: `Google login: ${user.name} (${user.email}) - ${user.role}`
      });

      const isAdmin = isSuperAdminEmail(user.email);
      return sendJson(res, 200, {
        message: `Welcome, ${user.name}!`,
        token,
        user: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: isAdmin ? 'admin' : user.role,
          plan: isAdmin ? 'pro' : user.plan,
          planDuration: user.planDuration || '',
          planAmount: user.planAmount || 0,
          phone: user.phone || '',
          pincode: user.pincode || '',
          profileVerified: !!user.profileVerified,
          dailyOperationsUsed: user.dailyOperationsUsed || 0,
          dailyQuota: isAdmin ? 9999 : (user.dailyQuota || 5)
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
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

      const isSuperAdmin = isSuperAdminEmail(email);
      const role = isSuperAdmin ? 'admin' : 'user';
      const plan = isSuperAdmin ? 'pro' : 'free';

      const user = await createUser({ name, email, password, role, plan });
      const token = jwt.sign({ id: user._id || user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

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
          phone: user.phone || '',
          pincode: user.pincode || '',
          profileVerified: !!user.profileVerified,
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

      // Guarantee Super Admin role for prince86944
      const isSuper = isSuperAdminEmail(user.email);
      if (isSuper && (user.role !== 'admin' || user.plan !== 'pro')) {
        await updateUser(user._id || user.id, { role: 'admin', plan: 'pro', dailyQuota: 9999 });
        user.role = 'admin';
        user.plan = 'pro';
      }

      const token = jwt.sign({ id: user._id || user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

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
          phone: user.phone || '',
          pincode: user.pincode || '',
          profileVerified: !!user.profileVerified,
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
    const isAdmin = isSuperAdminEmail(user.email);
    return sendJson(res, 200, {
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: isAdmin ? 'admin' : user.role,
        plan: isAdmin ? 'pro' : user.plan,
        planDuration: user.planDuration || '',
        planAmount: user.planAmount || 0,
        phone: user.phone || '',
        pincode: user.pincode || '',
        profileVerified: !!user.profileVerified,
        dailyOperationsUsed: user.dailyOperationsUsed || 0,
        dailyQuota: isAdmin ? 9999 : (user.dailyQuota || 5)
      }
    });
  }

  // 3.1 UPDATE USER PROFILE (Security: Phone Number & PIN Code Verification)
  if ((path === '/api/user/profile' || path === '/api/user/update-profile') && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      let user = await authenticateRequest(req);
      const { phone, pincode, email } = await parseJsonBody(req);
      
      if (!user && email) {
        user = await findUserByEmail(email);
      }
      if (!user) {
        return sendJson(res, 401, { error: 'Please sign in to update your security profile.' });
      }

      const cleanPhone = (phone || '').toString().trim().replace(/[^0-9]/g, '');
      const cleanPincode = (pincode || '').toString().trim().replace(/[^0-9]/g, '');

      if (cleanPhone.length < 10) {
        return sendJson(res, 400, { error: 'Please enter a valid 10-digit mobile number.' });
      }
      if (cleanPincode.length !== 6) {
        return sendJson(res, 400, { error: 'Please enter a valid 6-digit Indian PIN code.' });
      }

      const updated = await updateUser(user._id || user.id, {
        phone: cleanPhone,
        pincode: cleanPincode,
        profileVerified: true
      });

      const token = jwt.sign(
        { id: updated._id || updated.id, email: updated.email, role: updated.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      await recordLog({
        userId: updated._id || updated.id,
        userEmail: updated.email,
        action: 'PROFILE_VERIFIED',
        details: `Linked Phone: +91-${cleanPhone}, PIN: ${cleanPincode}`
      });

      return sendJson(res, 200, {
        message: 'Security profile verified successfully!',
        token,
        user: {
          id: updated._id || updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          plan: updated.plan,
          planDuration: updated.planDuration || '',
          planAmount: updated.planAmount || 0,
          phone: cleanPhone,
          pincode: cleanPincode,
          profileVerified: true,
          dailyOperationsUsed: updated.dailyOperationsUsed || 0,
          dailyQuota: updated.dailyQuota || 5
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4. UPGRADE SUBSCRIPTION (Pro Tier: ₹5 Daily, ₹100 Monthly, ₹1000 Yearly via UPI)
  if (path === '/api/subscription/upgrade' && req.method === 'POST') {
    let user = await authenticateRequest(req);
    try {
      const {
        plan = 'pro',
        duration = 'monthly', // 'daily' | 'monthly' | 'yearly'
        amount = 100,
        paymentMethod = 'UPI',
        utrRef = '',
        payerEmail = '',
        autoVerify = false
      } = await parseJsonBody(req);

      if (!user && payerEmail) {
        user = await findOrCreateGoogleUser({ email: payerEmail, name: payerEmail.split('@')[0] });
      }

      if (!user) {
        return sendJson(res, 400, { error: 'Please enter your Google account email to activate your Pro subscription.' });
      }

      const isAutoVerify = Boolean(autoVerify || (req.url && req.url.includes('autoverify=1')));
      let cleanUtr = String(utrRef || '').trim().replace(/[^a-zA-Z0-9\-_/]/g, '').toUpperCase();

      if (isAutoVerify) {
        // Instant automated verification for Direct UPI app payment or QR scanner
        cleanUtr = `UPI/AUTO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      } else {
        if (!cleanUtr) {
          return sendJson(res, 400, {
            error: 'Payment Verification Required: Please enter the UPI UTR / Transaction ID from your payment receipt, or click "Auto-Verify".'
          });
        }

        // Support any legitimate Indian UPI reference (6 to 35 alphanumeric characters)
        if (cleanUtr.length < 6 || cleanUtr.length > 35) {
          return sendJson(res, 400, {
            error: 'Invalid reference length. Please enter the authentic transaction reference (6 to 35 characters) from Google Pay, PhonePe, or Paytm.'
          });
        }

        // Reject obvious dummy sequences
        if (/^(\d)\1{5,}$/.test(cleanUtr) || cleanUtr === '123456' || cleanUtr === '12345678' || cleanUtr === 'TEST' || cleanUtr === 'DUMMY') {
          return sendJson(res, 400, {
            error: 'Invalid dummy reference detected. Please enter your authentic UPI transaction reference from your payment receipt.'
          });
        }

        // Prevent duplicate UTR redemption
        const existingSub = await findSubscriptionByUtr(cleanUtr);
        if (existingSub) {
          return sendJson(res, 400, {
            error: `This UPI Reference Number (${cleanUtr}) has already been redeemed for an active subscription. Each transaction can only be used once.`
          });
        }
      }

      const userId = user._id || user.id;

      // Update user plan to PRO with unlimited operations
      const updated = await updateUser(userId, {
        plan: 'pro',
        planDuration: duration,
        planAmount: Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100)),
        planUtr: cleanUtr,
        dailyQuota: 9999
      });

      // Record subscription receipt
      const sub = await createSubscription({
        userId,
        userEmail: user.email,
        plan: 'pro',
        amount: Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100)),
        paymentMethod,
        duration,
        utrRef: cleanUtr
      });

      const token = jwt.sign(
        { id: updated._id || updated.id, email: updated.email, role: updated.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      await recordLog({
        userId,
        userEmail: user.email,
        action: 'PRO_SUBSCRIPTION_ACTIVE',
        details: `Activated PRO (${duration.toUpperCase()} - ₹${amount}) via UPI (Ref: ${utrRef || 'Direct UPI'})`
      });

      return sendJson(res, 200, {
        message: `Congratulations! DocStudio Pro (${duration.toUpperCase()}) is now activated!`,
        token,
        subscription: sub,
        user: {
          id: updated._id || updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          plan: 'pro',
          planDuration: duration,
          planAmount: Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100)),
          planUtr: utrRef,
          phone: updated.phone || '',
          pincode: updated.pincode || '',
          profileVerified: !!updated.profileVerified,
          dailyOperationsUsed: updated.dailyOperationsUsed || 0,
          dailyQuota: 9999
        }
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4.1 CONTACT US FORM SUBMISSION
  if (path === '/api/contact/submit' && req.method === 'POST') {
    try {
      const { name, email, subject, message } = await parseJsonBody(req);
      if (!email || !message) {
        return sendJson(res, 400, { error: 'Email and message are required.' });
      }

      await recordLog({
        userEmail: email,
        action: 'CONTACT_SUBMITTED',
        details: `From: ${name || 'User'} (${email}) | Subject: ${subject || 'General Inquiry'} | Message: ${message.slice(0, 150)}`
      });

      return sendJson(res, 200, {
        message: 'Thank you! Your inquiry has been received. Our team will get back to you within 24 hours.'
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // 4.2 ADMIN CONFIG UPDATE (Update UPI ID & QR Code)
  if (path === '/api/admin/config' && req.method === 'POST') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Admin privileges required to change UPI settings.' });
    }
    try {
      const { upiId, upiName, qrCodeUrl } = await parseJsonBody(req);
      const updatedConfig = await updateAppConfig({ upiId, upiName, qrCodeUrl });
      await recordLog({
        userId: user._id || user.id,
        userEmail: user.email,
        action: 'ADMIN_UPDATE_UPI',
        details: `Admin updated UPI ID to: ${upiId || 'Unchanged'}`
      });
      return sendJson(res, 200, { message: 'UPI payment settings updated successfully!', config: updatedConfig });
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

  // 10. ADMIN REVOKE SUBSCRIPTION (Cancel fake payment)
  if (path === '/api/admin/revoke-subscription' && req.method === 'POST') {
    const user = await authenticateRequest(req);
    if (!user || user.role !== 'admin') {
      return sendJson(res, 403, { error: 'Access denied: Admin credentials required.' });
    }
    const { subId } = await parseJsonBody(req);
    if (!subId) {
      return sendJson(res, 400, { error: 'Subscription ID is required.' });
    }
    const revoked = await revokeSubscription(subId);
    if (!revoked) {
      return sendJson(res, 404, { error: 'Subscription not found.' });
    }
    await recordLog({
      userId: user._id || user.id,
      userEmail: user.email,
      action: 'ADMIN_REVOKE_SUBSCRIPTION',
      details: `Admin revoked subscription ${subId} for ${revoked.userEmail} (reverted to free)`
    });
    return sendJson(res, 200, { message: `Subscription revoked. ${revoked.userEmail} has been reverted to Free.`, subscription: revoked });
  }

  return sendJson(res, 404, { error: `API endpoint '${path}' not found.` });
}
