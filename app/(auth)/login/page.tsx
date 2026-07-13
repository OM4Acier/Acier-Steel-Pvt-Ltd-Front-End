/**
 * app/(auth)/login/page.tsx
 *
 * Stack: Next.js App Router · Static Export · @clerk/react v7 · shadcn/ui · react-hook-form · zod
 *
 * Two render states:
 *   1. Password step  — default
 *   2. OTP step       — when signIn.status === 'needs_client_trust' | 'needs_second_factor'
 */

'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useSignIn, useClerk } from '@clerk/react';
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

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

const otpSchema = z.object({
  code: z.string().length(6, { message: 'Please enter the 6-digit code' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type OTPFormValues = z.infer<typeof otpSchema>;

// ─── Shared neumorphic className tokens ─────────────────────────────────────

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

const secondaryButtonBase = [
  'text-gray-400 hover:text-red-500 transition-colors text-xs font-medium uppercase tracking-widest',
  'mt-4 py-2 px-4 rounded-xl bg-[#e0e5ec] shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff]',
  'active:shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff]',
].join(' ');

const buttonLoading = 'opacity-70 cursor-wait shadow-none active:scale-100';

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { signIn, errors: clerkErrors, fetchStatus } = useSignIn();
  const { signOut } = useClerk();

  const isFetching = fetchStatus === 'fetching';

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  // Shared post-finalize navigation — stable across renders
  const navigate = useCallback(
    ({
      session,
      decorateUrl,
    }: {
      session: { currentTask?: unknown } | null;
      decorateUrl: (url: string) => string;
    }) => {
      if (session?.currentTask) return; // Clerk will handle session-task redirect
      const url = decorateUrl('/');
      if (url.startsWith('http')) {
        window.location.href = url;
      } else {
        router.push(url);
      }
    },
    [router],
  );

  // ── Password step submit ──────────────────────────────────────────────────

  const onSubmit = async (data: LoginFormValues) => {
    if (!signIn) return;

    const { error } = await signIn.password({
      emailAddress: data.email,
      password: data.password,
    });

    if (error) {
      // clerkErrors.fields mirrors server-normalised field errors
      const message =
        clerkErrors?.fields?.password?.message ??
        clerkErrors?.fields?.identifier?.message ??
        'Invalid credentials';
      toast.error(message, {
        description: 'Please check your credentials and try again.',
        duration: 4000,
      });
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate });
      toast.success('Welcome back!', {
        description: 'You have successfully logged in.',
        duration: 3000,
      });
      return;
    }

    // Client Trust or MFA required — send OTP and let status drive the render
    if (
      signIn.status === 'needs_client_trust' ||
      signIn.status === 'needs_second_factor'
    ) {
      const emailCodeFactor = signIn.supportedSecondFactors?.find(
        (f) => f.strategy === 'email_code',
      );
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        toast.info('Verification code sent', {
          description: 'Check your email for the 6-digit code.',
        });
      }
      return;
    }

    // Unexpected status — surface for debugging
    toast.error('Login incomplete', {
      description: `Unexpected status: ${signIn.status}. Contact admin if this persists.`,
    });
  };

  // ── OTP step submit ───────────────────────────────────────────────────────

  const onVerify = async (data: OTPFormValues) => {
    if (!signIn) return;

    await signIn.mfa.verifyEmailCode({ code: data.code });

    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate });
      toast.success('Welcome back!', {
        description: 'You have successfully logged in.',
        duration: 3000,
      });
      return;
    }

    toast.error('Verification failed', {
      description:
        clerkErrors?.fields?.code?.message ?? 'Invalid or expired code.',
    });
  };

  const handleResendCode = async () => {
    if (!signIn) return;
    await signIn.mfa.sendEmailCode();
    toast.info('New code sent', { description: 'Check your email.' });
  };

  const handleStartOver = () => {
    signIn?.reset();
    otpForm.reset();
    loginForm.reset();
  };

  const handleSignOut = async () => {
    await signOut();
    toast.info('Signed out', { description: 'You have been signed out of all sessions.' });
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
                unoptimized // required for next export static builds
              />
            </div>
            <h1
              className="text-3xl font-extrabold text-gray-600 tracking-tight text-center"
              style={{ textShadow: '1px 1px 2px white, -1px -1px 2px #a3b1c6' }}
            >
              Organization Login
            </h1>
          </div>
          <div className="w-full">
            {children}
          </div>
          
          <button
            onClick={handleSignOut}
            className={secondaryButtonBase}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── OTP step ──────────────────────────────────────────────────────────────

  if (
    signIn?.status === 'needs_client_trust' ||
    signIn?.status === 'needs_second_factor'
  ) {
    return (
      <CardShell>
        <p className="text-center text-gray-500 text-sm mb-8">
          Enter the 6-digit code sent to your email address.
        </p>

        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onVerify)} className="space-y-8">
            <FormField
              control={otpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center">
                  <FormLabel className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Verification Code
                  </FormLabel>
                  <FormControl>
                    <InputOTP maxLength={6} disabled={isFetching} {...field}>
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className={cn(
                              'w-10 h-12 bg-[#e0e5ec] rounded-xl border-none text-gray-700 font-bold',
                              'shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]',
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

            <Button
              type="submit"
              disabled={isFetching}
              className={cn(buttonBase, isFetching && buttonLoading)}
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isFetching}
            className="text-blue-500 hover:text-blue-700 text-xs font-medium transition-colors disabled:opacity-50"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={handleStartOver}
            disabled={isFetching}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            Start over
          </button>
        </div>
      </CardShell>
    );
  }

  // ── Password step (default) ───────────────────────────────────────────────

  return (
    <CardShell>
      <Form {...loginForm}>
        <form onSubmit={loginForm.handleSubmit(onSubmit)} className="space-y-8">
          {/* Email */}
          <FormField
            control={loginForm.control}
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
                        loginForm.formState.errors.email
                          ? 'text-red-400'
                          : 'text-gray-400 group-focus-within:text-blue-500',
                      )}
                    />
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="your.email@organization.com"
                      disabled={isFetching}
                      className={cn(
                        inputBase,
                        loginForm.formState.errors.email && inputError,
                      )}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-red-500 text-xs ml-4 mt-2 font-medium animate-pulse" />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={loginForm.control}
            name="password"
            render={({ field }) => (
              <FormItem className="group">
                <div className="flex justify-between items-center ml-4 mb-2">
                  <FormLabel className="block text-xs font-bold text-gray-500 uppercase tracking-widest m-0">
                    Password
                  </FormLabel>
                  <a
                    href="/forgot-password"
                    className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
                  >
                    Forgot Password?
                  </a>
                </div>
                <FormControl>
                  <div className="relative">
                    <Lock
                      className={cn(
                        'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 transition-colors duration-300',
                        loginForm.formState.errors.password
                          ? 'text-red-400'
                          : 'text-gray-400 group-focus-within:text-blue-500',
                      )}
                    />
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      disabled={isFetching}
                      className={cn(
                        inputBase,
                        loginForm.formState.errors.password && inputError,
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
            disabled={isFetching}
            className={cn(buttonBase, isFetching && buttonLoading)}
          >
            {isFetching ? (
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
          </Button>
        </form>
      </Form>

      <p className="text-center text-gray-500 text-xs mt-10 font-medium">
        Don&rsquo;t have an account?{' '}
        <a
          href="#"
          className="text-blue-500 hover:text-blue-700 transition-colors underline-offset-4 decoration-dotted underline"
        >
          Contact Admin
        </a>
      </p>
    </CardShell>
  );
}