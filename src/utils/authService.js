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
    if (!this.user) return false;
    const email = (this.user.email || '').toLowerCase().trim();
    return this.user.role === 'admin' || email === 'prince86944@gmail.com' || email === 'prince869442@gmail.com' || email.startsWith('prince86944');
  }

  isPro() {
    return true; // 100% Free Access enabled
  }

  getUser() {
    return this.user;
  }

  isProfileVerified() {
    if (!this.user) return true;
    const email = (this.user.email || '').toLowerCase().trim();
    if (localStorage.getItem('docstudio_security_verified_' + email) === 'true') {
      return true;
    }
    const phone = String(this.user.phone || localStorage.getItem('docstudio_user_phone_' + email) || '').trim().replace(/[^0-9]/g, '');
    const pincode = String(this.user.pincode || localStorage.getItem('docstudio_user_pincode_' + email) || '').trim().replace(/[^0-9]/g, '');
    if ((phone.length >= 10 && pincode.length >= 6) || !!this.user.profileVerified || this.isAdmin() || this.isPro()) {
      localStorage.setItem('docstudio_security_verified_' + email, 'true');
      return true;
    }
    return false;
  }

  getQuotaRemaining() {
    return 'Unlimited';
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

  async createRazorpayOrder(amount = 100, duration = 'monthly', plan = 'pro', payerEmail = '') {
    try {
      const emailToUse = payerEmail || (this.user?.email || '');
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan,
          amount,
          duration,
          payerEmail: emailToUse
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment');
      return data;
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  }

  async verifyRazorpayPayment(paymentResponse, amount, duration, payerEmail = '') {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          amount,
          duration,
          plan: 'pro',
          payerEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment verification failed');

      if (data.token) {
        this.token = data.token;
        localStorage.setItem('docstudio_jwt', this.token);
      }
      this.user = data.user;
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));
      this.notifyAuthChange();
      toast.success(data.message || '🎉 DocStudio Pro activated successfully!');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async upgradeToPro(paymentMethod = 'UPI', amount = 100, duration = 'monthly', utrRef = '', payerEmail = '') {
    try {
      const emailToUse = payerEmail || (this.user?.email || '');
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan: 'pro',
          amount: Number(amount) || 100,
          duration,
          paymentMethod,
          utrRef,
          payerEmail: emailToUse
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription upgrade failed');

      if (data.token) {
        this.token = data.token;
        localStorage.setItem('docstudio_jwt', this.token);
      }
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

  async updateUserProfile(phone, pincode) {
    const email = (this.user?.email || '').toLowerCase().trim();
    // Persist verified status and contact info immediately
    localStorage.setItem('docstudio_security_verified_' + email, 'true');
    localStorage.setItem('docstudio_user_phone_' + email, phone);
    localStorage.setItem('docstudio_user_pincode_' + email, pincode);

    if (this.user) {
      this.user.phone = phone;
      this.user.pincode = pincode;
      this.user.profileVerified = true;
      localStorage.setItem('docstudio_user', JSON.stringify(this.user));
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone,
          pincode,
          email: this.user?.email || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed');

      if (data.token) {
        this.token = data.token;
        localStorage.setItem('docstudio_jwt', this.token);
      }
      if (data.user) {
        this.user = { ...this.user, ...data.user, phone, pincode, profileVerified: true };
        localStorage.setItem('docstudio_user', JSON.stringify(this.user));
      }
      this.notifyAuthChange();
      return { success: true, user: this.user };
    } catch (err) {
      console.warn('Backend profile sync note:', err.message);
      this.notifyAuthChange();
      return { success: true, user: this.user };
    }
  }

  async checkAndRecordUsage(toolId, filename) {
    return { allowed: true, remaining: 'Unlimited' };
  }

  notifyAuthChange() {
    window.dispatchEvent(new CustomEvent('docstudio:auth-change', {
      detail: { user: this.user, isLoggedIn: this.isLoggedIn(), isPro: this.isPro(), isAdmin: this.isAdmin() }
    }));
  }
}

export const authService = new AuthService();
