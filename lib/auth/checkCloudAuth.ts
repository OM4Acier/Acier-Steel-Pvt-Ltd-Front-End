interface UserProfile {
  id: string;
  name?: string;
  email: string;
  role: 'super-admin' | 'sales' | 'accountant' | 'operations' | undefined ;
  contactNo?: string;
  organization?: string;
  accessToken: string;
}

export async function checkCloudAuth(): Promise<any> {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    localStorage.removeItem('currentUserProfile');
    localStorage.removeItem('accessToken');
    throw new Error('No access token found');
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_API_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('currentUserProfile');
      localStorage.removeItem('accessToken');
      throw new Error('Token missing or unauthorized');
    }

    if (res.status === 403) {
      localStorage.clear();
      throw new Error('Invalid token');
    }

    const data = await res.json();

    if (!data.success || !data.user) {
      localStorage.clear();
      throw new Error('User fetch failed');
    }

    const user: UserProfile = {
      id: data.user.id || data.user.userId,
      name: data.user.name || data.user.email.split('@')[0],
      email: data.user.email,
      role: data.user.role,
      //contactNo: data.user.contactNo,
      //organization: data.user.organization,
      accessToken: token, // ⬅ token from localStorage, not returned from /me
    };
  
    return user;
  } catch (err: any) {
    localStorage.clear(); // Catch-all logout fallback
    throw new Error(err?.message || 'Session check failed');
  }
}
