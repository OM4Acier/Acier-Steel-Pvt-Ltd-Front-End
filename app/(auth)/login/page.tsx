'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner'; // Using Sonner as requested
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';

// --- Imports from your project structure ---
// Ensure these paths match your actual project structure
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { apiService } from '@/lib/data';
import { UserProfile } from '@/types/rbac.types';

// import { UserProfile } from '@/types/user'; // Import your types if they are in a separate file

// --- Utility for cleaner tailwind classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Zod Schema Validation ---
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const returnTo = '/'; // Default redirect path
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. Redirect if already logged in ---
  useEffect(() => {
    (async () => {
      try {
        await checkCloudAuth();
        toast.success("You're already logged in!");
        router.replace(returnTo);
      } catch {
        // User is not logged in; stay on page
      }
    })();
  }, [router, returnTo]);

  // --- 2. Form Setup (React Hook Form) ---
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // --- 3. Handle Login Logic (Integrated from useLoginHandler) ---
  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);

    try {
      // A. Make API Call
      // We use data.email and data.password from the form
      const response = await apiService.loginUser(data.email, data.password);

      // B. Create User Profile Object
      // (Mapping logic taken from your snippet)
      const user: UserProfile = {
        id: response.user.id,
        name: response.user.name || response.user.email.split('@')[0],
        email: response.user.email,
        role: response.user.role,
        contactNo: response.user.contactNo,
        organization: response.user.organization,
        accessToken: response.accessToken,
        permissions: response.user.permissions
      };

      // C. Store Authentication Data
      localStorage.setItem('accessToken', user.accessToken);
      localStorage.setItem('currentUserProfile', JSON.stringify(user));

      // D. Success Notification
      toast.success(`Welcome back, ${user.name}!`, {
        description: 'You have successfully logged in.',
        duration: 3000,
      });

      // E. Redirect
      router.push(returnTo);

    } catch (error: any) {
      // F. Error Handling
      // We try to extract the message, falling back to a default
      const errorMessage = error?.response?.data?.message || error.message || 'Authentication Failed';

      toast.error(errorMessage, {
        description: 'Please check your credentials and try again.',
        duration: 4000,
      });

      // Optional: Log network errors for debugging
      console.warn('Login Attempt Failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e0e5ec] p-4 font-sans relative overflow-hidden">

      {/* Ambient Background Depth */}
      <div
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 50%), radial-gradient(circle at 80% 80%, #a3b1c6 0%, transparent 50%)',
        }}
      />
      
      {/* Main Card */}
      <div className="relative z-10 bg-[#e0e5ec] p-8 md:p-12 rounded-[40px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] w-full max-w-md border border-white/20 transition-all duration-500 ease-out animate-card-fade-in">

        {/* Header Section */}
        <div className="flex flex-col items-center mb-10">
        <div className="h-24 w-24 bg-[#e0e5ec] rounded-full shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] flex items-center justify-center mb-6 overflow-hidden p-2">
            <Image
              src="/Logo_Login.webp"
              alt={`Logo`}
              width={600}
              height={200}
              className="w-full h-full object-contain"
              //className="h-8 w-auto sm:h-12 filter brightness-125 contrast-125"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-600 tracking-tight text-center"
            style={{ textShadow: '1px 1px 2px white, -1px -1px 2px #a3b1c6' }}>
            Organization Login
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* Email Input */}
          <div className="group">
            <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-4 mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                {...register("email")}
                id="email"
                type="email"
                placeholder="your.email@organization.com"
                disabled={isLoading}
                className={cn(
                  "w-full pl-12 pr-4 py-4 bg-[#e0e5ec] rounded-2xl border-none outline-none text-gray-700 placeholder-gray-400/70 transition-all duration-300",
                  // Skeuomorphic Inset Shadows
                  "shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]",
                  // Focus State
                  "focus:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] focus:text-blue-600",
                  // Error State
                  errors.email && "shadow-[inset_4px_4px_8px_#fca5a5,inset_-4px_-4px_8px_#ffffff] text-red-500 placeholder-red-300"
                )}
              />
              <Mail
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300",
                  errors.email ? "text-red-400" : "text-gray-400 group-focus-within:text-blue-500"
                )}
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs ml-4 mt-2 font-medium animate-pulse">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="group">
            <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-4 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                {...register("password")}
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={isLoading}
                className={cn(
                  "w-full pl-12 pr-4 py-4 bg-[#e0e5ec] rounded-2xl border-none outline-none text-gray-700 placeholder-gray-400/70 transition-all duration-300",
                  "shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]",
                  "focus:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] focus:text-blue-600",
                  errors.password && "shadow-[inset_4px_4px_8px_#fca5a5,inset_-4px_-4px_8px_#ffffff] text-red-500 placeholder-red-300"
                )}
              />
              <Lock
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300",
                  errors.password ? "text-red-400" : "text-gray-400 group-focus-within:text-blue-500"
                )}
              />
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs ml-4 mt-2 font-medium animate-pulse">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-gray-600 text-lg uppercase tracking-wider flex items-center justify-center gap-2",
              "bg-[#e0e5ec] transition-all duration-200",
              // Extruded Shadow (Default)
              "shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]",
              // Hover State
              "hover:text-blue-600 hover:scale-[1.01]",
              // Active (Pressed) State -> Becomes Inset
              "active:shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff] active:scale-[0.98]",
              // Loading State
              isLoading && "opacity-70 cursor-wait shadow-none active:scale-100"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Logging In...</span>
              </>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-10 font-medium animate-fade-in animation-delay-500">
          Don&rsquo;t have an account?
          <a href="#" className="ml-1 text-blue-500 hover:text-blue-700 transition-colors duration-200 underline-offset-4 decoration-dotted underline">
            Contact Admin
          </a>
        </p>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-card-fade-in { animation: card-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .animation-delay-500 { animation-delay: 0.5s; }
      `}</style>
    </div>
  );
}