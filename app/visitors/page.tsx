"use client"
import { Loader2, XCircle } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useRef, useEffect } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useUser } from '@clerk/react';
import { usePermissionStore } from '@/stores/permission-store';
import { visitorApi } from '@/lib/api/endpoints/visitorApi';
import { VisitorData } from '@/types/visitor.types';

// Define purpose options based on organizational needs
const PURPOSE_OPTIONS = [
  { value: 'client_record', label: 'Client Record Maintenance', hindi: 'ग्राहक रिकॉर्ड रखरखाव', collectSpecs: true },
  { value: 'research', label: 'Product Research & Information', hindi: 'उत्पाद अनुसंधान और सूचना', collectSpecs: true },
  { value: 'manufacturing', label: 'Manufacturing Product Inquiry', hindi: 'विनिर्माण उत्पाद पूछताछ', collectSpecs: false },
  { value: 'business_acier', label: 'Acier Steel Business Inquiry', hindi: 'एसियर स्टील व्यावसायिक पूछताछ', collectSpecs: false },
  { value: 'sales', label: 'Sales / Inquiry', hindi: 'बिक्री / पूछताछ', collectSpecs: false },
  { value: 'other', label: 'Other', hindi: 'अन्य', collectSpecs: true },
];

// Define products for quick selection
const ACIER_PRODUCTS = [
  { value: 'hr_coil', label: 'HR Coil / Sheet' },
  { value: 'cr_coil', label: 'CR Coil / Sheet' },
  { value: 'galvanized', label: 'Galvanized Steel (GP/GC)' },
  { value: 'ppgi_ppgl', label: 'PPGI / PPGL' },
  { value: 'ms_plate', label: 'MS Plate' },
  { value: 'structural', label: 'Structural (Beam/Channel)' },
  { value: 'rounds_flats', label: 'Rounds / Flats' },
];

// Define quick tags for purpose
const QUICK_TAGS = [
  { id: 'price', label: 'Price Inquiry', hindi: 'मूल्य पूछताछ' },
  { id: 'stock', label: 'Stock Availability', hindi: 'स्टॉक उपलब्धता' },
  { id: 'delivery', label: 'Delivery Timeline', hindi: 'वितरण समय' },
  { id: 'tech', label: 'Technical Spec', hindi: 'तकनीकी विशिष्टता' },
  { id: 'sample', label: 'Sample Request', hindi: 'नमूना अनुरोध' },
];

// Root App Component
const App: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);
  const [showHindi, setShowHindi] = useState<boolean>(false);

  // Form fields state
  const [visitorName, setVisitorName] = useState<string>('');
  const [contactNo, setContactNo] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('');
  const [purposeOfVisit, setPurposeOfVisit] = useState<string>('');

  // Efficiency states
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Smart Collection fields
  const [typographyInfo, setTypographyInfo] = useState<string>('');
  const [colorInfo, setColorInfo] = useState<string>('');
  const [spatialInfo, setSpatialInfo] = useState<string>('');
  const [depthInfo, setDepthInfo] = useState<string>('');

  const [notes, setNotes] = useState<string>('');
  const [uploadedDocument, setUploadedDocument] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);

  // Map Clerk user to legacy shape
  const user = React.useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: role || (clerkUser.publicMetadata?.role as string) || 'sales',
    };
  }, [clerkUser, role]);

  // Auto-fill logic for purpose
  useEffect(() => {
    if (selectedPurpose === 'sales' || selectedPurpose === 'manufacturing' || selectedPurpose === 'research') {
      const productLabel = ACIER_PRODUCTS.find(p => p.value === selectedProduct)?.label || '';
      const tagsLabels = activeTags.map(tagId => QUICK_TAGS.find(t => t.id === tagId)?.label).filter(Boolean);

      let autoText = '';
      if (productLabel) autoText += `Inquiry for ${productLabel}. `;
      if (tagsLabels.length > 0) autoText += `Focus on: ${tagsLabels.join(', ')}. `;

      if (autoText) {
        setPurposeOfVisit(prev => {
          // Only auto-fill if the field is empty or already contains auto-generated content
          if (!prev || prev.startsWith('Inquiry for') || prev.startsWith('Focus on')) {
            return autoText;
          }
          return prev;
        });
      }
    }
  }, [selectedProduct, activeTags, selectedPurpose]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      //setIsCreateOrderDialogOpen(true);

      // Remove 'action=create' from the URL so it can be triggered again without refresh
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  // Convert file to base64 string
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Validate form fields
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!visitorName.trim()) errors.visitorName = 'Visitor Name is required.';
    if (!contactNo.trim()) errors.contactNo = 'Contact No. is required.';
    else if (!/^\d{10}$/.test(contactNo)) errors.contactNo = 'Please enter a valid 10-digit phone number.';
    if (!organization.trim()) errors.organization = 'Organization is required.';
    if (!purposeOfVisit.trim()) errors.purposeOfVisit = 'Purpose of Visit is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Function to record a user visit
  const handleRecordVisit = async () => {
    if (!validateForm()) {
      setMessage('Please fill in all required fields. 🚫');
      return;
    }
    setIsRecording(true);
    setMessage('Recording visit...');
    const visitorData: VisitorData = {
      visitorName, contactNo, organization, purposeOfVisit, notes,
      documentBase64: null, documentName: null, documentMimeType: null,
      typographyInfo: typographyInfo || undefined,
      colorInfo: colorInfo || undefined,
      spatialInfo: spatialInfo || undefined,
      depthInfo: depthInfo || undefined,
    };
    try {
      if (uploadedDocument) {
        const base64String = await fileToBase64(uploadedDocument);
        visitorData.documentBase64 = base64String;
        visitorData.documentName = uploadedDocument.name;
        visitorData.documentMimeType = uploadedDocument.type;
      }
      
      const result = await visitorApi.recordVisit(visitorData);
      
      if (!result.success) {
        setMessage(`Error: ${result.error || result.message || 'Server error'} ❌`);
      } else {
        setMessage('Visit recorded successfully! ✅');
        setVisitorName(''); setContactNo(''); setOrganization('');
        setSelectedPurpose(''); setPurposeOfVisit('');
        setSelectedProduct(''); setActiveTags([]);
        setTypographyInfo(''); setColorInfo(''); setSpatialInfo(''); setDepthInfo(''); setNotes('');
        setUploadedDocument(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFormErrors({});
        setShowOptionalFields(false);
      }
    } catch (error: any) {
      console.error('Error recording visit:', error);
      setMessage(`Error recording visit: ${error.message} ❌`);
    } finally {
      setIsRecording(false);
      setTimeout(() => setMessage(null), 7000);
    }
  };

  const getTranslation = (en: string, hi: string) => showHindi ? `${en} / ${hi}` : en;

  if (!clerkLoaded) {
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
        <p className="text-lg text-center">Please ensure you are logged in.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/**  
     * <UniversalNavBar
        currentUserProfile={user}
        isLoggedIn={!user}
        handleLogout={handleLogout}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen} 
        searchTerm={''} 
        setSearchTerm={() => {}} 
        currentPath={pathname}  
      /> 
 */}
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-12 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50 font-sans">
        <div className="w-full max-w-3xl p-6 md:p-10 rounded-3xl bg-white shadow-2xl border border-gray-100 dark:bg-gray-900 dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:border-gray-800 transition-all duration-500">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-500">
              Visitor Registry
            </h1>
            <p className="mt-3 text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase text-xs">
              Acier Steel Pvt. Ltd. | Client Specification Management
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleRecordVisit(); }} className="space-y-8">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-bold tracking-widest uppercase py-1.5 px-4 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                onClick={() => setShowHindi(!showHindi)}
              >
                {showHindi ? 'English Mode' : 'हिंदी मोड'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="visitorName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  {getTranslation('Visitor Name', 'आगंतुक का नाम')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="visitorName"
                  placeholder="Ex: John Doe"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  maxLength={100}
                  className={`w-full p-4 rounded-2xl border text-gray-800 bg-gray-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all dark:text-gray-200 dark:bg-gray-800/50 ${formErrors.visitorName ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                />
                {formErrors.visitorName && <p className="text-red-500 text-[10px] font-bold uppercase ml-2">{formErrors.visitorName}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="contactNo" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  {getTranslation('Contact No.', 'संपर्क नंबर')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="contactNo"
                  placeholder="10-digit number"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  maxLength={10}
                  className={`w-full p-4 rounded-2xl border text-gray-800 bg-gray-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all dark:text-gray-200 dark:bg-gray-800/50 ${formErrors.contactNo ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                />
                {formErrors.contactNo && <p className="text-red-500 text-[10px] font-bold uppercase ml-2">{formErrors.contactNo}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="organization" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                {getTranslation('Organization / Company', 'संगठन / कंपनी')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="organization"
                placeholder="Company Name"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                maxLength={200}
                className={`w-full p-4 rounded-2xl border text-gray-800 bg-gray-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all dark:text-gray-200 dark:bg-gray-800/50 ${formErrors.organization ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {formErrors.organization && <p className="text-red-500 text-[10px] font-bold uppercase ml-2">{formErrors.organization}</p>}
            </div>

            <div className="space-y-4">
              <label htmlFor="purposeOfVisit" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                {getTranslation('Purpose of Visit', 'आने का उद्देश्य')} <span className="text-red-500">*</span>
              </label>

              <Select
                value={selectedPurpose}
                onValueChange={(value) => {
                  setSelectedPurpose(value);
                  const option = PURPOSE_OPTIONS.find(o => o.value === value);
                  if (value !== 'other' && value !== 'sales' && value !== 'manufacturing') {
                    setPurposeOfVisit(option ? option.label : '');
                  }
                }}
              >
                <SelectTrigger className={`w-full p-4 h-14 rounded-2xl border text-gray-800 bg-gray-50/50 focus:ring-4 focus:ring-blue-500/10 dark:text-gray-200 dark:bg-gray-800/50 transition-all ${formErrors.purposeOfVisit ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <SelectValue placeholder={getTranslation('Select core purpose', 'मूल उद्देश्य चुनें')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-2xl">
                  {PURPOSE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="py-3 rounded-lg">
                      {getTranslation(option.label, option.hindi)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Efficiency Boosters */}
              {(selectedPurpose === 'sales' || selectedPurpose === 'manufacturing' || selectedPurpose === 'research') && (
                <div className="space-y-4 p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 ml-1 block">Quick Product Selection</label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger className="w-full h-10 rounded-xl bg-white dark:bg-gray-900">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific product</SelectItem>
                          {ACIER_PRODUCTS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400 mb-2 ml-1 block">Inquiry Type (Tap to add)</label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TAGS.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setActiveTags(prev =>
                              prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${activeTags.includes(tag.id)
                              ? 'bg-blue-500 border-blue-600 text-white shadow-md'
                              : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:border-blue-400'
                            }`}
                        >
                          {getTranslation(tag.label, tag.hindi)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <textarea
                id="purposeOfVisit"
                rows={2}
                placeholder={getTranslation('Provide specific visit details...', 'विशिष्ट विज़िट विवरण प्रदान करें...')}
                value={purposeOfVisit}
                onChange={(e) => setPurposeOfVisit(e.target.value)}
                maxLength={500}
                className={`w-full p-4 rounded-2xl border text-gray-800 bg-gray-50/50 resize-none focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all dark:text-gray-200 dark:bg-gray-800/50 ${formErrors.purposeOfVisit ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {formErrors.purposeOfVisit && <p className="text-red-500 text-[10px] font-bold uppercase ml-2">{formErrors.purposeOfVisit}</p>}
            </div>

            {PURPOSE_OPTIONS.find(o => o.value === selectedPurpose)?.collectSpecs && (
              <div className="mt-8 p-6 rounded-3xl bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1.5 w-8 bg-blue-500 rounded-full" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Specification Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">1. Typography Systems</label>
                    <textarea value={typographyInfo} onChange={(e) => setTypographyInfo(e.target.value)} placeholder="..." className="w-full p-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none h-24 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">2. Color Language</label>
                    <textarea value={colorInfo} onChange={(e) => setColorInfo(e.target.value)} placeholder="..." className="w-full p-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none h-24 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">3. Spatial Composition</label>
                    <textarea value={spatialInfo} onChange={(e) => setSpatialInfo(e.target.value)} placeholder="..." className="w-full p-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none h-24 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">4. Depth & Layering</label>
                    <textarea value={depthInfo} onChange={(e) => setDepthInfo(e.target.value)} placeholder="..." className="w-full p-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none h-24 resize-none" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center pt-6">
              <button type="submit" disabled={isRecording} className="w-full md:w-auto px-12 py-4 rounded-full font-extrabold text-white bg-gradient-to-br from-indigo-600 to-blue-600 hover:shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-lg">
                {isRecording ? <Loader2 className="w-6 h-6 animate-spin" /> : getTranslation('Record Entry', 'प्रविष्टि दर्ज करें')}
              </button>
              <button type="button" className="mt-6 text-xs font-bold text-gray-400 hover:text-blue-500 uppercase tracking-widest" onClick={() => setShowOptionalFields(!showOptionalFields)}>
                {showOptionalFields ? 'Hide Notes & Docs' : 'Attach Notes / Identity Proof'}
              </button>
            </div>

            {showOptionalFields && (
              <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-500">
                <div className="space-y-2">
                  <label htmlFor="notes" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Additional Observations</label>
                  <textarea id="notes" rows={3} placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 dark:bg-gray-800/50" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ID Proof / Documents</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer bg-gray-50/30 hover:bg-gray-50 dark:border-gray-700">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                      <p className="text-xs text-gray-400 uppercase">{uploadedDocument ? uploadedDocument.name : 'PDF, PNG, JPG (MAX. 5MB)'}</p>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setUploadedDocument(e.target.files ? e.target.files[0] : null)} />
                  </label>
                </div>
              </div>
            )}
          </form>
          {message && <p className={`mt-10 text-sm font-bold text-center tracking-wide animate-in zoom-in duration-300 ${message.includes('Error') || message.includes('🚫') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default App;
