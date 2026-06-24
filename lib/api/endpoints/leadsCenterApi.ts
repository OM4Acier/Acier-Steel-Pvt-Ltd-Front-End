import { apiClient } from '../client';

export interface Lead {
    id: string;
    timestamp: string;
    name: string;
    email: string;
    phone: string;
    source: string;
    isClaimed: boolean;
    rowNumber?: number;
    hasExistingLeads: boolean;
    existingLeadsCount: number;
    existingLeads: any[];
    productInterest?: string;
}

export interface DetailedLead {
    id: string;
    timestamp: string;
    name: string;
    email: string;
    phone: string;
    source: string;
    productInterest: string;
    clientName: string;
    isClaimed: boolean;
    countryCode?: string;
    nameSource?: string;
    hasExistingLeads: boolean;
    existingLeadsCount: number;
    existingLeads: any[];
}

export interface Pagination {
    currentPage: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface LeadsResponseData {
    leads: Lead[];
    pagination: Pagination;
    metadata: {
        userClaimedCount: number;
        totalRaw: number;
        dataSource: string;
        processingTime: number;
        timestamp: string;
    };
}

export interface LeadsResponse {
    success: boolean;
    data: LeadsResponseData;
}

export interface UserAccessResponseData {
    allowedSources: string[];
    claimedCount: number;
    userInfo: {
        email: string;
        name: string;
        role: string;
    };
}

export interface UserAccessResponse {
    success: boolean;
    data: UserAccessResponseData;
}

export interface DetailedLeadResponse {
    success: boolean;
    data: DetailedLead;
}

/**
 * lib/api/endpoints/leadsCenterApi.ts
 *
 * Centralized API endpoint methods for Leads Center.
 */
export const leadsCenterApi = {
    /**
     * Get user access allowed sources and claimed count
     * GET /user/access
     */
    getUserAccess: async (): Promise<UserAccessResponseData> => {
        const res = await apiClient.get<UserAccessResponse>('/user/access');
        if (!res) throw new Error('Request cancelled');
        return res.data;
    },

    /**
     * Get leads center records matching filters
     * GET /leads-center
     */
    getLeadsCenterLeads: async (params: {
        page?: number;
        limit?: number;
        source?: string;
        date?: string;
        search?: string;
    }, signal?: AbortSignal): Promise<LeadsResponseData> => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.source) queryParams.append('source', params.source);
        if (params.date) queryParams.append('date', params.date);
        if (params.search) queryParams.append('search', params.search);

        const res = await apiClient.get<LeadsResponse>(`/leads-center/center?${queryParams.toString()}`, { signal });
        if (!res) throw new Error('Request cancelled');
        return res.data;
    },

    /**
     * Get detailed lead details
     * GET /leads-center/:id
     */
    getLeadsCenterDetail: async (id: string, source: string): Promise<DetailedLead> => {
        const queryParams = new URLSearchParams({ source });
        const res = await apiClient.get<DetailedLeadResponse>(`/leads-center/center/${id}?${queryParams.toString()}`);
        if (!res) throw new Error('Request cancelled');
        return res.data;
    },

    /**
     * Claim and create lead in LMS
     * POST /leads
     */
    claimLead: async (payload: any): Promise<any> => {
        return apiClient.post<any>('/leads-center/center/claim', payload);
    }
};
