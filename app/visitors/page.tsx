"use client"
import UniversalNavBar from '@/components/NavBar';
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { UserProfile } from '@/types/rbac.types';
import { Loader2, XCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';



// Define the data interface for type safety
interface VisitorData {
  visitorName: string;
  contactNo: string;
  organization: string;
  purposeOfVisit: string;
  notes: string;
  documentBase64: string | null;
  documentName: string | null;
  documentMimeType: string | null;
}

// Root App Component
const App: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);
  const [showHindi, setShowHindi] = useState<boolean>(true);
  //const [accessToken, setAccessToken] = useState<string>('');
    const pathname = usePathname();
    const router = useRouter(); // Add this if not already present
  

  // Form fields state
  const [visitorName, setVisitorName] = useState<string>('');
  const [contactNo, setContactNo] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [purposeOfVisit, setPurposeOfVisit] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [uploadedDocument, setUploadedDocument] = useState<File | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define API constants
  const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:3000';

  // Simulate setting the access token with useEffect
 // Updated useEffect with new authentication logic
 useEffect(() => {
    const validateSession = async () => {
      try {
        // First try the new cloud auth method
        const user = await checkCloudAuth();
        const fullUser: UserProfile = {
          ...user,
          accessToken: localStorage.getItem('accessToken') || '',
        };
        setUser(fullUser);
        setLoadingApp(false);

        // Check if user role is allowed
        const allowedRoles = ['super-admin', 'sales', 'operations', 'accountant', 'purchase-entry'];
        if (!allowedRoles.includes(user.role)) {
          toast.error('Access denied. Your role does not permit access to this dashboard.');
          router.replace('/');
          setLoadingApp(false);
          return;
        }

      } catch (err: any) {
        console.warn('Cloud auth failed, falling back to localStorage:', err.message);

        // Fallback to localStorage method
        const local = localStorage.getItem('currentUserProfile');
        const token = localStorage.getItem('accessToken');

        if (!local || !token) {
          toast.error('Please login first');
          setLoadingApp(false);
          router.replace('/login?returnTo=' + encodeURIComponent(pathname));
          return;
        }

        try {
          const parsedUser: UserProfile = JSON.parse(local);
          const fullUser: UserProfile = {
            ...parsedUser,
            accessToken: token
          };
          setUser(fullUser);
          setLoadingApp(false);

          // Check role permissions for localStorage users too
          const allowedRoles = ['super-admin', 'sales', 'operations', 'accountant'];
          if (!allowedRoles.includes(parsedUser.role as string)) {
            toast.error('Access denied. Your role does not permit access to this dashboard.');
            router.replace('/');
            return;
          }

        } catch (parseError) {
          console.error("Error parsing user profile from localStorage:", parseError);
          toast.error("Failed to load user profile. Please log in again.");
          localStorage.clear();
          setLoadingApp(false);
          router.replace('/login?returnTo=' + encodeURIComponent(pathname));
        }
      }
    };

    validateSession();
  }, [router, toast, pathname]); // Added pathname to dependencies


  // Convert file to base64 string
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Validate form fields based on backend rules
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    // Visitor Name: Required, 2-100 characters
    if (!visitorName.trim()) {
      errors.visitorName = 'Visitor Name is required.';
    } else if (visitorName.length < 2 || visitorName.length > 100) {
      errors.visitorName = 'Must be between 2 and 100 characters.';
    }

    // Contact No: Required, 10 digits (using a simplified frontend check)
    if (!contactNo.trim()) {
      errors.contactNo = 'Contact No. is required.';
    } else if (!/^\d{10}$/.test(contactNo)) {
      errors.contactNo = 'Please enter a valid 10-digit phone number.';
    }
    
    // Organization: Required, 2-200 characters
    if (!organization.trim()) {
        errors.organization = 'Organization is required.';
    } else if (organization.length < 2 || organization.length > 200) {
        errors.organization = 'Must be between 2 and 200 characters.';
    }

    // Purpose of Visit: Required, 5-500 characters
    if (!purposeOfVisit.trim()) {
      errors.purposeOfVisit = 'Purpose of Visit is required.';
    } else if (purposeOfVisit.length < 5 || purposeOfVisit.length > 500) {
      errors.purposeOfVisit = 'Must be between 5 and 500 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Function to record a user visit
  const handleRecordVisit = async (accessToken: string) => {
    if (!validateForm()) {
      setMessage('Please fill in all required fields. 🚫');
      return;
    }

    setIsRecording(true);
    setMessage('Recording visit...');

    const visitorData: VisitorData = {
      visitorName,
      contactNo,
      organization,
      purposeOfVisit,
      notes,
      documentBase64: null,
      documentName: null,
      documentMimeType: null,
    };

    try {
      // Handle file conversion to Base64 if a document is uploaded
      if (uploadedDocument) {
        const base64String = await fileToBase64(uploadedDocument);
        visitorData.documentBase64 = base64String;
        visitorData.documentName = uploadedDocument.name;
        visitorData.documentMimeType = uploadedDocument.type;
      }

      // Post data to a server endpoint as specified in API docs
      console.log('Posting data to server:', visitorData);
      const response = await fetch(`${BASE_API_URL}/visitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(visitorData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific API errors
        if (result.error) {
          setMessage(`Error: ${result.error} ❌`);
        } else {
          throw new Error('Server response was not ok');
        }
      } else {
        setMessage('Visit recorded successfully! ✅');
        // Reset form fields
        setVisitorName('');
        setContactNo('');
        setOrganization('');
        setPurposeOfVisit('');
        setNotes('');
        setUploadedDocument(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFormErrors({});
        setShowOptionalFields(false);
      }

    } catch (error) {
      console.error('Error recording visit:', error);
      setMessage(`Error recording visit. Please try again. ❌`);
    } finally {
      setIsRecording(false);
      setTimeout(() => setMessage(null), 7000);
    }
  };

  const getTranslation = (en: string, hi: string) => showHindi ? `${en} / ${hi}` : en;


  const handleLogout = () => {
    localStorage.clear(); // Clear all local storage including tokens
    setLoadingApp(false); // Update logged in state
    setUser(null); // Clear user profile
    router.replace('/login'); // Redirect to login page
};

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [loadingApp, setLoadingApp] = useState<boolean>(true);

  if (loadingApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied or Not Logged In</h2>
        <p className="text-lg text-center">Please ensure you are logged in and have the necessary permissions to view this dashboard.</p>
        <p className="text-sm text-gray-500 mt-2">
          (In a full Next.js app, you would be redirected to a login page here.)
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
     <UniversalNavBar
        currentUserProfile={user}
        isLoggedIn={!user}
        handleLogout={handleLogout}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen} searchTerm={''} setSearchTerm={function (term: string): void {
          toast.error(`Search not implemented. Term: ${term}`);
        } } currentPath={''}  /> 


    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-50 font-sans">
      <div className="w-full max-w-2xl p-8 rounded-2xl bg-white shadow-lg border border-gray-200 dark:bg-gray-900 dark:shadow-2xl dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-500 animate-fade-in-down">
            Visitor
          </h1>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleRecordVisit(user?.accessToken ?? ""); }} className="space-y-6">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              className="text-sm font-semibold py-1 px-3 rounded-full text-blue-600 hover:text-blue-800 hover:bg-gray-200 transition-colors dark:text-blue-400 dark:hover:text-white dark:hover:bg-gray-800"
              onClick={() => setShowHindi(!showHindi)}
            >
              {showHindi ? 'Disable Hindi' : 'Enable Hindi'}
            </button>
          </div>
          
          {/* Visitor Name */}
          <div>
            <label htmlFor="visitorName" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              {getTranslation('Visitor Name', 'आगंतुक का नाम')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="visitorName"
              placeholder="Enter full name"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              maxLength={100}
              className={`w-full p-3 rounded-md border text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:text-gray-200 dark:bg-gray-800 ${formErrors.visitorName ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
            />
            <p className="text-right text-xs text-gray-400 mt-1">{visitorName.length}/100</p>
            {formErrors.visitorName && <p className="text-red-500 text-xs mt-1">{formErrors.visitorName}</p>}
          </div>

          {/* Contact No. */}
          <div>
            <label htmlFor="contactNo" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              {getTranslation('Contact No.', 'संपर्क नंबर')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="contactNo"
              placeholder="e.g., +1234567890"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              maxLength={10}
              className={`w-full p-3 rounded-md border text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:text-gray-200 dark:bg-gray-800 ${formErrors.contactNo ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
            />
            {formErrors.contactNo && <p className="text-red-500 text-xs mt-1">{formErrors.contactNo}</p>}
          </div>
            
          {/* Organization */}
          <div>
            <label htmlFor="organization" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                {getTranslation('Organization / Company', 'संगठन / कंपनी')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="organization"
              placeholder="e.g., Acme Corp"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              maxLength={200}
              className={`w-full p-3 rounded-md border text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:text-gray-200 dark:bg-gray-800 ${formErrors.organization ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
            />
            <p className="text-right text-xs text-gray-400 mt-1">{organization.length}/200</p>
            {formErrors.organization && <p className="text-red-500 text-xs mt-1">{formErrors.organization}</p>}
          </div>

          {/* Purpose of Visit */}
          <div>
            <label htmlFor="purposeOfVisit" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              {getTranslation('Purpose of Visit', 'आने का उद्देश्य')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="purposeOfVisit"
              rows={2}
              placeholder="Briefly describe the purpose of the visit"
              value={purposeOfVisit}
              onChange={(e) => setPurposeOfVisit(e.target.value)}
              maxLength={500}
              className={`w-full p-3 rounded-md border text-gray-800 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:text-gray-200 dark:bg-gray-800 ${formErrors.purposeOfVisit ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
            />
            <p className="text-right text-xs text-gray-400 mt-1">{purposeOfVisit.length}/500</p>
            {formErrors.purposeOfVisit && <p className="text-red-500 text-xs mt-1">{formErrors.purposeOfVisit}</p>}
          </div>

          <button
            type="button"
            className="w-full text-sm font-semibold py-2 px-4 rounded-md text-blue-600 hover:text-blue-800 hover:bg-gray-200 transition-colors dark:text-blue-400 dark:hover:text-white dark:hover:bg-gray-800"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
          >
            {showOptionalFields ? getTranslation('Hide Optional Details', 'वैकल्पिक विवरण छुपाएँ') : getTranslation('Show Optional Details', 'वैकल्पिक विवरण दिखाएँ')}
          </button>

          {showOptionalFields && (
            <div className="space-y-6 mt-4 animate-fade-in">
              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  {getTranslation('Notes', 'टिप्पणियाँ')}
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Any additional notes about the visit"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  className="w-full p-3 rounded-md border border-gray-300 text-gray-800 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800"
                />
                <p className="text-right text-xs text-gray-400 mt-1">{notes.length}/1000</p>
              </div>

              {/* Uploaded Documents / ID proof */}
              <div>
                <label htmlFor="uploadedDocument" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  {getTranslation('Uploaded Documents / ID proof', 'अपलोड किए गए दस्तावेज़ / आईडी प्रमाण')}
                </label>
                <input
                  type="file"
                  id="uploadedDocument"
                  ref={fileInputRef}
                  onChange={(e) => setUploadedDocument(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isRecording}
              className="w-full py-3 px-4 rounded-full font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isRecording ? (
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                getTranslation('Record Visitor Entry', 'आगंतुक प्रविष्टि दर्ज करें')
              )}
            </button>
          </div>
        </form>
    
        {message && (
          <p className={`mt-5 text-sm font-medium text-center animate-fade-in ${message.includes('Error') || message.includes('🚫') ? 'text-red-500' : 'text-green-500'}`}>
            {message}
          </p>
        )}
      </div>
    </div>

    </div>
  );
};

export default App;
