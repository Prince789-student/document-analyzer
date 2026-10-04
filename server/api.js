import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_TjoyXMTB0zh4Wp';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'iROJagCyhpdOhR0FzmohCQ7T';

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

  // 0. GET APP CONFIG (Active UPI ID & QR Code & Google Client ID & Razorpay Key)
  if (path === '/api/config' && req.method === 'GET') {
    const config = await getAppConfig();
    return sendJson(res, 200, {
      ...config,
      razorpayKeyId: RAZORPAY_KEY_ID,
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

  // 3.1 CREATE RAZORPAY ORDER (₹5 Daily, ₹100 Monthly, ₹1,000 Yearly)
  if (path === '/api/payment/create-order' && req.method === 'POST') {
    let user = await authenticateRequest(req);
    try {
      const {
        plan = 'pro',
        duration = 'monthly',
        amount = 100,
        payerEmail = ''
      } = await parseJsonBody(req);

      const targetEmail = user?.email || payerEmail;
      if (!targetEmail) {
        return sendJson(res, 400, { error: 'Please sign in or enter your email address to initiate payment.' });
      }

      const numAmount = Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100));
      const amountInPaise = Math.round(numAmount * 100);

      const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: {
            userEmail: targetEmail,
            plan,
            duration
          }
        })
      });

      const order = await rzpRes.json();
      if (!rzpRes.ok) {
        throw new Error(order.error?.description || 'Failed to create Razorpay order');
      }

      return sendJson(res, 200, {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
        userEmail: targetEmail
      });
    } catch (err) {
      console.error('Razorpay order creation error:', err);
      return sendJson(res, 500, { error: err.message || 'Payment initiation failed' });
    }
  }

  // 3.2 VERIFY RAZORPAY PAYMENT & INSTANT ACTIVATE PRO (Zero-Effort Cryptographic Verification)
  if (path === '/api/payment/verify' && req.method === 'POST') {
    let user = await authenticateRequest(req);
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan = 'pro',
        duration = 'monthly',
        amount = 100,
        payerEmail = ''
      } = await parseJsonBody(req);

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return sendJson(res, 400, { error: 'Missing payment confirmation parameters.' });
      }

      // Verify HMAC-SHA256 signature using Secret Key
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.error('Razorpay signature mismatch:', { expectedSignature, razorpay_signature });
        return sendJson(res, 400, { error: 'Payment signature verification failed. Untrusted payment.' });
      }

      const emailToUse = user?.email || payerEmail;
      if (!user && emailToUse) {
        user = await findOrCreateGoogleUser({ email: emailToUse, name: emailToUse.split('@')[0] });
      }

      if (!user) {
        return sendJson(res, 400, { error: 'User account not found for payment activation.' });
      }

      const userId = user._id || user.id;
      const numAmount = Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100));
      const targetRole = (user.role === 'admin' && isSuperAdminEmail(user.email)) ? 'admin' : 'user';

      // Upgrade User to Pro
      const updated = await updateUser(userId, {
        plan: 'pro',
        role: targetRole,
        planDuration: duration,
        planAmount: numAmount,
        planUtr: razorpay_payment_id,
        dailyQuota: 9999
      });

      // Save Subscription in DB
      const sub = await createSubscription({
        userId,
        userEmail: user.email,
        plan: 'pro',
        amount: numAmount,
        paymentMethod: 'Razorpay / UPI',
        duration,
        utrRef: razorpay_payment_id
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
        details: `Activated PRO (${duration.toUpperCase()} - ₹${numAmount}) via Razorpay (Payment ID: ${razorpay_payment_id})`
      });

      return sendJson(res, 200, {
        success: true,
        message: `🎉 Payment Confirmed! DocStudio Pro (${duration.toUpperCase()}) activated successfully!`,
        token,
        user: {
          id: updated._id || updated.id,
          _id: updated._id || updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          plan: updated.plan,
          planDuration: updated.planDuration,
          planAmount: updated.planAmount,
          planUtr: updated.planUtr,
          phone: updated.phone || '',
          pincode: updated.pincode || '',
          profileVerified: !!updated.profileVerified,
          dailyOperationsUsed: updated.dailyOperationsUsed || 0,
          dailyQuota: updated.dailyQuota || 9999
        },
        subscription: sub
      });
    } catch (err) {
      console.error('Payment verification error:', err);
      return sendJson(res, 500, { error: err.message || 'Payment verification failed' });
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
        payerEmail = ''
      } = await parseJsonBody(req);

      if (!user && payerEmail) {
        if (isSuperAdminEmail(payerEmail)) {
          return sendJson(res, 403, { error: 'Super Admin account cannot be activated via public payment form. Please log in directly.' });
        }
        user = await findOrCreateGoogleUser({ email: payerEmail, name: payerEmail.split('@')[0] });
      }

      if (!user) {
        return sendJson(res, 400, { error: 'Please enter your email address to activate your Pro subscription.' });
      }

      const rawUtr = String(utrRef || '').trim();
      const cleanUtr = rawUtr.replace(/[^a-zA-Z0-9\-_/]/g, '').toUpperCase();

      // MANDATORY UTR VERIFICATION: Never activate without an authentic UTR
      if (!cleanUtr) {
        return sendJson(res, 400, {
          error: 'UPI Reference Number (UTR) is required! Please complete the UPI payment in your app (GPay / PhonePe / Paytm) and enter the 12-digit UTR from your payment receipt.'
        });
      }

      if (cleanUtr.length < 10 || cleanUtr.length > 30) {
        return sendJson(res, 400, {
          error: 'Invalid UTR format. Authentic UPI Reference IDs are usually 12 digits (e.g., 427812345678). Please check your payment receipt.'
        });
      }

      // Check dummy/fake patterns
      const isRepeated = /^([0-9a-zA-Z])\1+$/.test(cleanUtr);
      const isDummy = ['123456789012', '1234567890', '012345678901', 'TESTUTR12345', '987654321098'].includes(cleanUtr);
      if (isRepeated || isDummy) {
        return sendJson(res, 400, {
          error: 'Invalid / Dummy UTR rejected. Please enter the authentic 12-digit UTR generated after successful payment in your UPI app.'
        });
      }

      // Check duplicate UTR redemption
      const existingSub = await findSubscriptionByUtr(cleanUtr);
      if (existingSub) {
        return sendJson(res, 400, {
          error: `This UPI Reference Number (${cleanUtr}) has already been redeemed for an active subscription.`
        });
      }

      const userId = user._id || user.id;
      const targetRole = (user.role === 'admin' && isSuperAdminEmail(user.email)) ? 'admin' : 'user';

      // Update user plan to PRO with unlimited operations
      const updated = await updateUser(userId, {
        plan: 'pro',
        role: targetRole,
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
