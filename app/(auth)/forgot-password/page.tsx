'use client';

import { Button } from '@/components/ui/button';

/**
 * app/(auth)/forgot-password/page.tsx
 *
 * Forgot Password Flow using Clerk v7 Core 3 patterns.
 * Maintains neumorphic design consistency with LoginPage.


'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowRight, RotateCcw, ArrowLeft, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useSignIn, useClerk } from '@clerk/nextjs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

// ─── Schemas ────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

const resetSchema = z.object({
  code: z.string().length(6, { message: 'Please enter the 6-digit code' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

// ─── Shared neumorphic style tokens ──────────────────────────────────────────

const inputBase = [
  'w-full pl-12 pr-4 py-4 h-auto bg-[#e0e5ec] rounded-2xl border-none outline-none ring-0',
  'text-gray-700 placeholder-gray-400/70 transition-all duration-300',
  'shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]',
  'focus-visible:ring-0 focus-visible:ring-offset-0',
  'focus:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] focus:text-blue-600',
].join(' ');

const inputError = [
  'shadow-[inset_4px_4px_8px_#fca5a5,inset_-4px_-4px_8px_#ffffff]',
  'text-red-500',
].join(' ');

const buttonBase = [
  'w-full py-4 rounded-2xl font-bold text-gray-600 text-lg uppercase tracking-wider',
  'flex items-center justify-center gap-2 bg-[#e0e5ec] h-auto transition-all duration-200',
  'shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]',
  'hover:text-blue-600 hover:scale-[1.01] hover:bg-[#e0e5ec]',
  'active:shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff] active:scale-[0.98]',
].join(' ');

const buttonLoading = 'opacity-70 cursor-wait shadow-none active:scale-100';

// ─── Component ───────────────────────────────────────────────────────────────

type Step = 'EMAIL' | 'RESET';

export function ForgotPasswordPage() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  
  const [step, setStep] = useState<Step>('EMAIL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '' },
  });

  // ── Step 1: Request Reset Code ────────────────────────────────────────────

  const onRequestCode = async (data: EmailFormValues) => {
    if (!isLoaded || !signIn) return;
    setIsSubmitting(true);

    try {
      const { error } = await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: data.email,
      });

      if (error) {
        toast.error(error.message || 'Failed to send reset code');
        return;
      }

      setStep('RESET');
      toast.success('Verification code sent', {
        description: 'Check your email for the 6-digit code.',
      });
    } catch (err: any) {
      console.error('Request code error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: Reset Password ───────────────────────────────────────────────

  const onResetPassword = async (data: ResetFormValues) => {
    if (!isLoaded || !signIn) return;
    setIsSubmitting(true);

    try {
      const { error } = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: data.code,
        password: data.password,
      });

      if (error) {
        toast.error(error.message || 'Failed to reset password');
        return;
      }

      if (signIn.status === 'complete') {
        await setActive({ session: signIn.createdSessionId });
        toast.success('Password reset successful', {
          description: 'You have been automatically logged in.',
        });
        router.push('/');
      } else {
        toast.error('Unexpected status', {
          description: `Status: ${signIn.status}. Please try logging in normally.`,
        });
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setStep('EMAIL');
    emailForm.reset();
    resetForm.reset();
  };

  // ── Shared card shell ─────────────────────────────────────────────────────

  function CardShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 50%), radial-gradient(circle at 80% 80%, #a3b1c6 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 bg-[#e0e5ec] p-8 md:p-12 rounded-[40px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] w-full max-w-md border border-white/20 flex flex-col items-center">
          <div className="flex flex-col items-center mb-10 w-full">
            <div className="h-24 w-24 bg-[#e0e5ec] rounded-full shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] flex items-center justify-center mb-6 overflow-hidden p-2">
              <Image
                src="/Logo_Login.webp"
                alt="Logo"
                width={600}
                height={200}
                className="w-full h-full object-contain"
                unoptimized
              />
            </div>
            <h1
              className="text-3xl font-extrabold text-gray-600 tracking-tight text-center"
              style={{ textShadow: '1px 1px 2px white, -1px -1px 2px #a3b1c6' }}
            >
              Reset Password
            </h1>
          </div>
          <div className="w-full">
            {children}
          </div>
          
          <button
            onClick={() => router.push('/login')}
            className="text-gray-400 hover:text-blue-500 transition-colors text-xs font-medium uppercase tracking-widest mt-8 flex items-center gap-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── STEP_EMAIL: Request code ──────────────────────────────────────────────

  if (step === 'EMAIL') {
    return (
      <CardShell>
        <p className="text-center text-gray-500 text-sm mb-8">
          Enter your email address and we&apos;ll send you a 6-digit code to reset your password.
        </p>

        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onRequestCode)} className="space-y-8">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem className="group">
                  <FormLabel className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-4 mb-2">
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail
                        className={cn(
                          'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 transition-colors duration-300',
                          emailForm.formState.errors.email
                            ? 'text-red-400'
                            : 'text-gray-400 group-focus-within:text-blue-500',
                        )}
                      />
                      <Input
                        {...field}
                        type="email"
                        placeholder="your.email@organization.com"
                        disabled={isSubmitting}
                        className={cn(
                          inputBase,
                          emailForm.formState.errors.email && inputError,
                        )}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 text-xs ml-4 mt-2 font-medium animate-pulse" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(buttonBase, isSubmitting && buttonLoading)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>Send Code</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardShell>
    );
  }

  // ── STEP_RESET: Verify & Reset ────────────────────────────────────────────

  return (
    <CardShell>
      <p className="text-center text-gray-500 text-sm mb-8">
        Verify your identity with the 6-digit code and choose a strong new password.
      </p>

      <Form {...resetForm}>
        <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-8">
          {/* OTP Code 
          <FormField
            control={resetForm.control}
            name="code"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center">
                <FormLabel className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Verification Code
                </FormLabel>
                <FormControl>
                  <InputOTP maxLength={6} disabled={isSubmitting} {...field}>
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className={cn(
                            'w-10 h-12 bg-[#e0e5ec] rounded-xl border-none text-gray-700 font-bold',
                            'shadow-[inset_4px_4px_8px_#b8b9be,inset_-6px_-6px_12px_#ffffff]',
                            'focus:ring-0 data-[active]:shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]',
                          )}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage className="text-red-500 text-xs mt-2 font-medium animate-pulse" />
              </FormItem>
            )}
          />

/          {/* New Password
//          <FormField
            control={resetForm.control}
            name="password"
            render={({ field }) => (
              <FormItem className="group">
                <FormLabel className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-4 mb-2">
                  New Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock
                      className={cn(
                        'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 transition-colors duration-300',
                        resetForm.formState.errors.password
                          ? 'text-red-400'
                          : 'text-gray-400 group-focus-within:text-blue-500',
                      )}
                    />
                    <Input
                      {...field}
                      type="password"
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      className={cn(
                        inputBase,
                        resetForm.formState.errors.password && inputError,
                      )}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-red-500 text-xs ml-4 mt-2 font-medium animate-pulse" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(buttonBase, isSubmitting && buttonLoading)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <span>Reset Password</span>
                <ShieldCheck className="w-5 h-5" />
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="flex justify-center mt-6">
        <button
          type="button"
          onClick={handleStartOver}
          disabled={isSubmitting}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" />
          Start over
        </button>
      </div>
    </CardShell>
  );
}
 */
export default function notavailable(){
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-700 mb-4">Forgot Password</h1>
        <p className="text-gray-500 mb-6">This feature is currently unavailable.</p>
        <Button onClick={() => window.location.href = '/login'} variant="outline">
          Back to Login
        </Button>
      </div>
    </div>
  );

}
