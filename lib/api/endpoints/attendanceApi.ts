import { apiClient } from '../client';


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


export interface ApiResponse<T> { success: boolean; data: T; message?: string; }
export interface ListResponse<T> { success: boolean; data: T[]; total: number; }

export const attendanceApi = {
  getStatus: async () => {
    const res = await apiClient.get<any>(`/presence/status`);
    if (!res) throw new Error('Request cancelled');
    return res.data || res;
    //return apiClient.get<{ success: boolean; data: IWarehouse[] }>('/v1/warehouses');
  },
  getConfig: async () => {
    const res = await apiClient.get<any>(`/presence/config`);
    if (!res) throw new Error('Request cancelled');
    return res.data || res;
  },
  login: async (record: AttendanceRecord) => {
    const res = await apiClient.post<ApiResponse<{ success: boolean; message: string; timestamp: string }>>(`/presence/login`, record);
    if (!res) throw new Error('Request cancelled');
    return res.data;
  },
  logout: async (record: AttendanceRecord) => {
    const res = await apiClient.post<ApiResponse<{ success: boolean; message: string; timestamp: string }>>(`/presence/logout`, record);
    if (!res) throw new Error('Request cancelled');
    return res.data;
  },
};