import { BASE_API_URL } from '../data';

export interface AttendanceLocation {
  locationId: string;
  name: string;
  mode: 'OFFICE' | 'FACTORY' | 'WFH';
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
}

export interface AttendanceConfig {
  locations: AttendanceLocation[];
  gpsAccuracyLimitMeters: number;
  gpsMaxAgeMs: number;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export interface AttendanceRecord {
  locationId: string;
  location: GPSLocation;
}

export interface AttendanceStatus {
  date: string;
  loginTime: string;
  logoutTime: string;
  status: string;
  locationId: string;
}

// Helper to clean up the base URL and ensure it points to the presence API
const getApiBase = () => {
  let base = BASE_API_URL;
  // Remove trailing slash if present
  if (base.endsWith('/')) base = base.slice(0, -1);

  // If it already ends with /api, just add /v1/presence
  if (base.endsWith('/api')) {
    return `${base}/v1/presence`;
  }

  // If it contains /api/ somewhere else, or doesn't have it at all
  // we want to ensure it follows the /api/v1/presence pattern
  if (!base.includes('/api')) {
    return `${base}/api/v1/presence`;
  }

  // Fallback: replace /api with /api/v1/presence if it's not already correct
  if (base.includes('/api') && !base.includes('/api/v1')) {
    return base.replace('/api', '/api/v1/presence');
  }

  return `${base}/presence`;
};

const API_BASE = getApiBase();

export const attendanceApi = {
  getConfig: async (token: string): Promise<AttendanceConfig> => {
    const response = await fetch(`${API_BASE}/config`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch attendance config');
    const { data } = await response.json();
    return data;
  },

  login: async (token: string, record: AttendanceRecord): Promise<{ success: boolean; message: string; timestamp: string }> => {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Login API Error:", error);
      return { success: false, message: "Network error during login", timestamp: new Date().toISOString() };
    }
  },

  logout: async (token: string, record: AttendanceRecord): Promise<{ success: boolean; message: string; timestamp: string }> => {
    try {
      const response = await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Logout API Error:", error);
      return { success: false, message: "Network error during logout", timestamp: new Date().toISOString() };
    }
  },

  getStatus: async (token: string): Promise<AttendanceStatus> => {
    const response = await fetch(`${API_BASE}/status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch attendance status');
    const { data } = await response.json();
    return data;
  },
};
