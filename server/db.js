import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'local_db.json');

let isMongoConnected = false;

// Initialize MongoDB Atlas connection if URI is provided
export async function initDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      isMongoConnected = true;
      console.log('Connected successfully to MongoDB Atlas cluster');
    } catch (err) {
      console.warn('MongoDB Atlas connection failed, falling back to persistent local storage:', err.message);
      isMongoConnected = false;
    }
  } else {
    console.log('No MONGODB_URI provided in environment. Operating in persistent local store mode.');
    isMongoConnected = false;
  }

  // Ensure default demo users exist
  await seedDefaultUsers();
}

// --------------------------------------------------------------------------
// Mongoose Models
// --------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  planDuration: { type: String, default: '' },
  planAmount: { type: Number, default: 0 },
  planUtr: { type: String, default: '' },
  phone: { type: String, default: '' },
  pincode: { type: String, default: '' },
  profileVerified: { type: Boolean, default: false },
  dailyOperationsUsed: { type: Number, default: 0 },
  dailyQuota: { type: Number, default: 5 },
  lastQuotaReset: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  plan: { type: String, required: true },
  amount: { type: Number, required: true },
  duration: { type: String, default: 'monthly' }, // 'daily' | 'monthly' | 'yearly'
  utrRef: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  status: { type: String, default: 'active' },
  paymentMethod: { type: String, default: 'UPI' },
  createdAt: { type: Date, default: Date.now }
});

const logSchema = new mongoose.Schema({
  userId: { type: String },
  userEmail: { type: String },
  action: { type: String, required: true },
  toolId: { type: String },
  details: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const MongoUser = mongoose.model('User', userSchema);
export const MongoSubscription = mongoose.model('Subscription', subscriptionSchema);
export const MongoLog = mongoose.model('AuditLog', logSchema);

// --------------------------------------------------------------------------
// Local Store Fallback Engine
// --------------------------------------------------------------------------
function readLocalDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial = {
        users: [],
        subscriptions: [],
        logs: [],
        config: {
          upiId: 'apnacollegebihar@slc',
          upiName: 'DocStudio Pro',
          qrCodeUrl: '/upi-qr.png'
        }
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.config || !parsed.config.upiId) {
      parsed.config = {
        upiId: 'apnacollegebihar@slc',
        upiName: 'DocStudio Pro',
        qrCodeUrl: '/upi-qr.png'
      };
    } else {
      parsed.config.upiId = 'apnacollegebihar@slc';
      parsed.config.qrCodeUrl = '/upi-qr.png';
    }
    return parsed;
  } catch (e) {
    return {
      users: [],
      subscriptions: [],
      logs: [],
      config: {
        upiId: 'apnacollegebihar@slc',
        upiName: 'DocStudio Pro',
        qrCodeUrl: '/upi-qr.png'
      }
    };
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local database:', e);
  }
}

export async function getAppConfig() {
  const db = readLocalDb();
  return db.config || {
    upiId: 'apnacollegebihar@slc',
    upiName: 'DocStudio Pro',
    qrCodeUrl: '/upi-qr.png'
  };
}

export async function updateAppConfig(newConfig) {
  const db = readLocalDb();
  db.config = { ...db.config, ...newConfig };
  writeLocalDb(db);
  return db.config;
}

export function isSuperAdminEmail(email) {
  if (!email) return false;
  const norm = email.toLowerCase().trim();
  return norm === 'prince86944@gmail.com' || norm === 'prince869442@gmail.com' || norm.startsWith('prince86944');
}

export async function findOrCreateGoogleUser({ email, name, avatar = '', googleId = '' }) {
  const normEmail = email.toLowerCase().trim();
  let user = await findUserByEmail(normEmail);

  const isSuperAdmin = isSuperAdminEmail(normEmail);
  const role = isSuperAdmin ? 'admin' : (user ? user.role : 'user');
  const plan = isSuperAdmin ? 'pro' : (user ? user.plan : 'free');

  if (user) {
    if (isSuperAdmin && (user.role !== 'admin' || user.plan !== 'pro')) {
      user = await updateUser(user._id || user.id, { role: 'admin', plan: 'pro', dailyQuota: 9999 });
    }
    return user;
  }

  // Create new Google user with generated secure token
  const randomPass = 'goog_' + Math.random().toString(36).slice(2) + Date.now();
  user = await createUser({
    name: name || normEmail.split('@')[0],
    email: normEmail,
    password: randomPass,
    role,
    plan
  });
  return user;
}

// --------------------------------------------------------------------------
// Unified Database Operations (Seamless MongoDB Atlas + Local Fallback)
// --------------------------------------------------------------------------
export async function findUserByEmail(email) {
  const normEmail = email.toLowerCase().trim();
  if (isMongoConnected) {
    return await MongoUser.findOne({ email: normEmail });
  }
  const db = readLocalDb();
  return db.users.find(u => u.email.toLowerCase() === normEmail) || null;
}

export async function findUserById(id) {
  if (isMongoConnected) {
    return await MongoUser.findById(id);
  }
  const db = readLocalDb();
  return db.users.find(u => u.id === id || u._id === id) || null;
}

export async function createUser({ name, email, password, role = 'user', plan = 'free' }) {
  const normEmail = email.toLowerCase().trim();
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (isMongoConnected) {
    const user = new MongoUser({
      name,
      email: normEmail,
      password: hashedPassword,
      role,
      plan,
      dailyQuota: plan === 'pro' ? 9999 : 5
    });
    return await user.save();
  }

  const db = readLocalDb();
  const newUser = {
    id: 'usr_' + Date.now() + Math.random().toString(36).substr(2, 4),
    name,
    email: normEmail,
    password: hashedPassword,
    role,
    plan,
    dailyOperationsUsed: 0,
    dailyQuota: plan === 'pro' ? 9999 : 5,
    lastQuotaReset: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  newUser._id = newUser.id;
  db.users.push(newUser);
  writeLocalDb(db);
  return newUser;
}

export async function updateUser(id, updateData) {
  if (isMongoConnected) {
    return await MongoUser.findByIdAndUpdate(id, updateData, { new: true });
  }
  const db = readLocalDb();
  const idx = db.users.findIndex(u => u.id === id || u._id === id);
  if (idx !== -1) {
    db.users[idx] = { ...db.users[idx], ...updateData };
    writeLocalDb(db);
    return db.users[idx];
  }
  return null;
}

export async function deleteUser(id) {
  if (isMongoConnected) {
    return await MongoUser.findByIdAndDelete(id);
  }
  const db = readLocalDb();
  db.users = db.users.filter(u => u.id !== id && u._id !== id);
  writeLocalDb(db);
  return true;
}

export async function getAllUsers() {
  if (isMongoConnected) {
    const users = await MongoUser.find().select('-password').sort({ createdAt: -1 });
    return users.map(u => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      plan: u.plan,
      planDuration: u.planDuration || '',
      planAmount: u.planAmount || 0,
      planUtr: u.planUtr || '',
      phone: u.phone || '',
      pincode: u.pincode || '',
      profileVerified: !!u.profileVerified,
      dailyOperationsUsed: u.dailyOperationsUsed || 0,
      dailyQuota: u.dailyQuota || 5,
      createdAt: u.createdAt
    }));
  }
  const db = readLocalDb();
  return db.users.map(({ password, ...rest }) => rest);
}

export async function createSubscription({ userId, userEmail, plan = 'pro', amount = 100, paymentMethod = 'UPI', duration = 'monthly', utrRef = '' }) {
  const numAmount = Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100));

  if (isMongoConnected) {
    const sub = new MongoSubscription({
      userId,
      userEmail,
      plan,
      amount: numAmount,
      duration,
      utrRef,
      paymentMethod
    });
    const saved = await sub.save();
    await MongoUser.findByIdAndUpdate(userId, {
      plan: 'pro',
      planDuration: duration,
      planAmount: numAmount,
      planUtr: utrRef,
      dailyQuota: 9999
    });
    return saved;
  }

  const db = readLocalDb();
  const newSub = {
    id: 'sub_' + Date.now(),
    userId,
    userEmail,
    plan,
    amount: numAmount,
    duration,
    utrRef,
    currency: 'INR',
    status: 'active',
    paymentMethod,
    createdAt: new Date().toISOString()
  };
  db.subscriptions.push(newSub);

  // Update user in local storage
  const userIdx = db.users.findIndex(u => u.id === userId || u._id === userId);
  if (userIdx !== -1) {
    db.users[userIdx].plan = 'pro';
    db.users[userIdx].planDuration = duration;
    db.users[userIdx].planAmount = numAmount;
    db.users[userIdx].planUtr = utrRef;
    db.users[userIdx].dailyQuota = 9999;
  }

  writeLocalDb(db);
  return newSub;
}

export async function recordLog({ userId, userEmail, action, toolId, details }) {
  if (isMongoConnected) {
    const log = new MongoLog({ userId, userEmail, action, toolId, details });
    return await log.save();
  }
  const db = readLocalDb();
  const newLog = {
    id: 'log_' + Date.now(),
    userId,
    userEmail,
    action,
    toolId,
    details,
    createdAt: new Date().toISOString()
  };
  db.logs.unshift(newLog);
  if (db.logs.length > 200) db.logs.pop();
  writeLocalDb(db);
  return newLog;
}

export async function getAdminMetrics() {
  const users = await getAllUsers();
  let subscriptions = [];
  let logs = [];

  if (isMongoConnected) {
    subscriptions = await MongoSubscription.find().sort({ createdAt: -1 });
    logs = await MongoLog.find().sort({ createdAt: -1 }).limit(50);
  } else {
    const db = readLocalDb();
    subscriptions = [...(db.subscriptions || [])].reverse();
    logs = (db.logs || []).slice(0, 50);
  }

  const totalUsers = users.length;
  const proSubscribers = users.filter(u => u.plan === 'pro' || u.plan === 'enterprise').length;
  const freeUsers = Math.max(0, totalUsers - proSubscribers);
  const dailyPasses = subscriptions.filter(s => s.duration === 'daily' || s.amount === 5).length;
  const monthlySubs = subscriptions.filter(s => s.duration === 'monthly' || s.amount === 100 || (!s.duration && s.amount !== 5 && s.amount !== 1000)).length;
  const yearlySubs = subscriptions.filter(s => s.duration === 'yearly' || s.amount === 1000).length;
  const totalRevenue = subscriptions.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalOperations = logs.filter(l => l.action.startsWith('TOOL_EXECUTE') || l.action.startsWith('TOOL_OPERATION')).length;

  return {
    totalUsers,
    proSubscribers,
    freeUsers,
    dailyPasses,
    monthlySubs,
    yearlySubs,
    totalRevenue,
    totalOperations,
    subscriptions: subscriptions.slice(0, 50),
    recentLogs: logs,
    isMongoConnected
  };
}

// --------------------------------------------------------------------------
// Default Seed Users
// --------------------------------------------------------------------------
async function seedDefaultUsers() {
  const superAdmin = await findUserByEmail('prince86944@gmail.com');
  if (!superAdmin) {
    await createUser({
      name: 'Prince (Super Admin)',
      email: 'prince86944@gmail.com',
      password: 'admin123',
      role: 'admin',
      plan: 'pro'
    });
    console.log('Seeded Super Admin: prince86944@gmail.com / admin123');
  } else if (superAdmin.role !== 'admin') {
    await updateUser(superAdmin._id || superAdmin.id, { role: 'admin', plan: 'pro' });
  }

  const admin = await findUserByEmail('admin@docstudio.com');
  if (!admin) {
    await createUser({
      name: 'DocStudio Admin',
      email: 'admin@docstudio.com',
      password: 'admin123',
      role: 'admin',
      plan: 'pro'
    });
    console.log('Seeded default Admin: admin@docstudio.com / admin123');
  }

  const pro = await findUserByEmail('pro@docstudio.com');
  if (!pro) {
    await createUser({
      name: 'Alex Rivera (Pro)',
      email: 'pro@docstudio.com',
      password: 'pro123',
      role: 'user',
      plan: 'pro'
    });
    console.log('Seeded default Pro user: pro@docstudio.com / pro123');
  }

  const demo = await findUserByEmail('demo@docstudio.com');
  if (!demo) {
    await createUser({
      name: 'Demo Free User',
      email: 'demo@docstudio.com',
      password: 'demo123',
      role: 'user',
      plan: 'free'
    });
    console.log('Seeded default Demo user: demo@docstudio.com / demo123');
  }
}
