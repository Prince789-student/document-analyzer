import { authService } from './authService.js';
import { toast } from './toast.js';

class AdminService {
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authService.token}`
    };
  }

  async getMetrics() {
    try {
      const res = await fetch('/api/admin/metrics', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to load admin metrics');
      return await res.json();
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  }

  async getUsers() {
    try {
      const res = await fetch('/api/admin/users', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to load user list');
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      toast.error(err.message);
      return [];
    }
  }

  async updateUser(id, updateData) {
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ id, ...updateData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      toast.success(data.message || 'User updated successfully');
      return data.user;
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  }

  async deleteUser(id) {
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      toast.info('User removed from database');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }
}

export const adminService = new AdminService();
