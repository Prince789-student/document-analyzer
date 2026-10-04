import { toast } from './toast.js';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('docstudio_jwt') || null;
    this.user = JSON.parse(localStorage.getItem('docstudio_user') || 'null');
    this.init();
  }

  async init() {
    if (this.token) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.user = data.user;
          localStorage.setItem('docstudio_user', JSON.stringify(this.user));
          this.notifyAuthChange();
        } else {
          // Token expired
          this.logout(false);
        }
      } catch (e) {
        console.warn('Auth offline check, using cached session');
      }
    }
  }

  isLoggedIn() {
    return !!this.user;
  }

  isAdmin() {
    return this.user && this.user.role === 'admin';
  }

  isPro() {
    return this.user && (this.user.plan === 'pro' || this.user.plan === 'enterprise' || this.user.role === 'admin');
  }

  getUser() {
    return this.user;
  }

  getQuotaRemaining() {
    if (!this.user) return 5;
    if (this.isPro()) return 'Unlimited';
    return Math.max(0, (this.user.dailyQuota || 5) - (this.user.dailyOperationsUsed || 0));
  }

  async login(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('docstudio_jwt', this.token);
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));

      this.notifyAuthChange();
      toast.success(`Welcome back, ${this.user.name}!`);
      return { success: true, user: this.user };
    } catch (err) {
      toast.error(err.message);
      return { success: false, error: err.message };
    }
  }

  async register(name, email, password) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('docstudio_jwt', this.token);
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));

      this.notifyAuthChange();
      toast.success(`Account created! Welcome to DocStudio, ${this.user.name}!`);
      return { success: true, user: this.user };
    } catch (err) {
      toast.error(err.message);
      return { success: false, error: err.message };
    }
  }

  async loginWithGoogle(emailOrPayload, name = '', avatar = '', googleId = '') {
    try {
      let body;
      if (typeof emailOrPayload === 'object' && emailOrPayload !== null) {
        body = emailOrPayload;
      } else {
        body = { email: emailOrPayload, name, avatar, googleId };
      }

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Sign-in failed');

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('docstudio_jwt', this.token);
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));

      this.notifyAuthChange();
      toast.success(`Welcome, ${this.user.name || this.user.email}!`);
      return { success: true, user: this.user };
    } catch (err) {
      toast.error(err.message);
      return { success: false, error: err.message };
    }
  }

  async loginWithGoogleCredential(credential) {
    return this.loginWithGoogle({ credential });
  }

  logout(showToast = true) {
    this.token = null;
    this.user = null;
    localStorage.removeItem('docstudio_jwt');
    localStorage.removeItem('docstudio_user');
    this.notifyAuthChange();
    if (showToast) toast.info('You have logged out.');
  }

  async upgradeToPro(paymentMethod = 'UPI', amount = 100, duration = 'monthly', utrRef = '') {
    if (!this.token) {
      toast.error('Please sign in with Google first.');
      return false;
    }
    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ plan: 'pro', amount: Number(amount) || 100, duration, paymentMethod, utrRef })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription upgrade failed');

      this.user = data.user;
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));
      this.notifyAuthChange();
      toast.success(data.message || 'DocStudio Pro activated successfully!');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async checkAndRecordUsage(toolId, filename) {
    if (!this.user) {
      // Guest usage check
      const guestCount = parseInt(localStorage.getItem('docstudio_guest_ops') || '0', 10);
      if (guestCount >= 5) {
        return {
          allowed: false,
          error: 'Daily limit reached! Please create a free account or upgrade to Pro for unlimited operations.'
        };
      }
      localStorage.setItem('docstudio_guest_ops', (guestCount + 1).toString());
      return { allowed: true, remaining: 5 - (guestCount + 1) };
    }

    try {
      const res = await fetch('/api/usage/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ toolId, filename })
      });
      const data = await res.json();
      if (res.status === 403) {
        return { allowed: false, error: data.error, quotaExceeded: true };
      }
      if (this.user && !this.isPro()) {
        this.user.dailyOperationsUsed = (this.user.dailyOperationsUsed || 0) + 1;
        localStorage.setItem('docstudio_user', JSON.stringify(this.user));
        this.notifyAuthChange();
      }
      return { allowed: true, remaining: data.remainingQuota };
    } catch (e) {
      // Local fallback
      return { allowed: true };
    }
  }

  notifyAuthChange() {
    window.dispatchEvent(new CustomEvent('docstudio:auth-change', {
      detail: { user: this.user, isLoggedIn: this.isLoggedIn(), isPro: this.isPro(), isAdmin: this.isAdmin() }
    }));
  }
}

export const authService = new AuthService();
