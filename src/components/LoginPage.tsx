import React, { useState } from 'react';
import { User } from '../types/cargotrace';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Ship,
  Calendar,
  MapPin,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Globe,
} from 'lucide-react';
import loginHeroTerminal from '../assets/images/login_hero_terminal_1794057885520.jpg';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@cargotrace.id');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'Sea Freight' | 'Air Freight' | 'Road Freight'>('Sea Freight');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('Please enter a valid password.');
      return;
    }

    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      setErrorMessage(
        'Account not found. Please check README.md for registered Admin, Operator, and Customer emails.'
      );
      return;
    }

    onLoginSuccess(matchedUser);
  };

  const handleInstantLogin = (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('password123');
    setErrorMessage(null);
    const matched = users.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (matched) {
      onLoginSuccess(matched);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#EBF1FA] flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-[1180px] min-h-[670px] bg-white rounded-[28px] shadow-[0_20px_60px_rgba(7,45,89,0.10)] border border-[#D8E3F4] grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* LEFT COLUMN: Visual Showcase (Inspired by SEWO reference layout) */}
        <div className="bg-[#F6F9FD] p-7 sm:p-10 flex flex-col justify-between relative border-b md:border-b-0 md:border-r border-[#E6EEF8]">
          {/* Top-Left Brand Mark */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2F6BFF] text-white flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[16px] font-extrabold tracking-wider text-[#1E40AF] uppercase">
                DND ATLAS
              </span>
              <span className="text-[11px] font-bold tracking-widest text-[#64748B] uppercase">
                Worldwide
              </span>
            </div>
          </div>

          {/* Center Visual Photo + Overlapping Floating Card */}
          <div className="relative my-6 flex items-center">
            <div className="w-[66%] h-[290px] sm:h-[325px] rounded-t-2xl rounded-bl-2xl rounded-br-[64px] overflow-hidden shadow-md border border-white">
              <img
                src={loginHeroTerminal}
                alt="DND Atlas Worldwide Port & Terminal"
                className="w-full h-full object-cover object-center"
              />
            </div>

            {/* Overlapping Floating Corridor Card (mirrors the SEWO floating search card) */}
            <div className="absolute right-0 sm:right-2 bottom-4 w-[235px] sm:w-[252px] bg-white rounded-2xl shadow-[0_14px_34px_rgba(7,45,89,0.12)] border border-[#E8EEF7] p-4 space-y-2.5">
              <button
                type="button"
                onClick={() =>
                  setPreviewMode((m) =>
                    m === 'Sea Freight'
                      ? 'Air Freight'
                      : m === 'Air Freight'
                      ? 'Road Freight'
                      : 'Sea Freight'
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E8EEF7] bg-[#F8FAFD] hover:border-[#2F6BFF] text-left transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#072D59]">
                  <Ship className="w-3.5 h-3.5 text-[#2F6BFF]" />
                  <span>{previewMode}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              </button>

              <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E8EEF7] bg-[#F8FAFD] text-[12px] text-[#64748B]">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#072D59]" />
                  <span>Nov 2026 Schedule</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              </div>

              <div className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E8EEF7] bg-[#F8FAFD] text-[12px] text-[#64748B]">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#072D59]" />
                  <span>SE Asia → Europe</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              </div>

              <div className="w-full py-2 rounded-lg bg-[#2F6BFF] text-white text-center text-[12.5px] font-semibold shadow-2xs">
                46 Active Shipments
              </div>
            </div>
          </div>

          {/* Bottom-Left Headline & Indicator Dots */}
          <div className="space-y-3">
            <h1 className="text-[28px] lg:text-[32px] font-extrabold text-[#072D59] tracking-tight leading-tight">
              Track your global cargo
            </h1>
            <p className="text-[14px] text-[#64748B] leading-relaxed max-w-sm">
              Monitor sea vessels, air freighters, and overland trucks in just a few clicks.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-8 h-1.5 rounded-full bg-[#2F6BFF]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#BFDBFE]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#BFDBFE]" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sign-In Form (Inspired by SEWO reference layout) */}
        <div className="bg-white p-7 sm:p-12 flex flex-col justify-between">
          {/* Top-Right Label */}
          <div className="flex items-center justify-end">
            <span className="text-[13px] font-bold text-[#072D59]">Login</span>
          </div>

          {/* Center Form Container */}
          <div className="w-full max-w-[380px] mx-auto my-auto space-y-6">
            <div>
              <h2 className="text-[26px] sm:text-[29px] font-extrabold text-[#072D59] tracking-tight">
                Welcome Back to DND Atlas!
              </h2>
              <p className="text-[13.5px] text-[#64748B] mt-1">
                Sign in your account
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#FFF0F3] border border-[#FD6E88] text-[#9F1D35] text-[12.5px] flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[12.5px] font-semibold text-[#1E293B] mb-1.5"
                >
                  Your Email
                </label>
                <input
                  id="login-email"
                  data-testid="login-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cargotrace.id"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-[13.5px] font-medium text-[#072D59] placeholder:text-[#94A3B8] focus:border-[#072D59] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[12.5px] font-semibold text-[#1E293B] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    data-testid="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-[13.5px] font-medium text-[#072D59] placeholder:text-[#94A3B8] focus:border-[#072D59] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#072D59] p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[12.5px]">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[#334155] font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#2F6BFF]"
                  />
                  <span>Remember Me</span>
                </label>
                <span className="text-[#64748B] text-[12px]">
                  Pass: <code className="font-semibold text-[#072D59]">password123</code>
                </span>
              </div>

              <button
                type="submit"
                data-testid="login-submit-button"
                className="w-full py-3 rounded-xl bg-[#2F6BFF] hover:bg-[#1D4ED8] text-white font-semibold text-[14px] shadow-sm transition-colors cursor-pointer"
              >
                Login
              </button>
            </form>

            {/* Divider matching "Instan Login" in the SEWO reference */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E2E8F0] w-full" />
              <span className="bg-white px-3 text-[11.5px] text-[#94A3B8] font-medium whitespace-nowrap">
                Instant Role Login
              </span>
              <div className="border-t border-[#E2E8F0] w-full" />
            </div>

            {/* Two side-by-side buttons matching SEWO bottom buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleInstantLogin('admin@cargotrace.id')}
                className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#2F6BFF] bg-white text-[12px] font-semibold text-[#1E293B] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#2F6BFF] shrink-0" />
                <span>Admin Portal</span>
              </button>
              <button
                type="button"
                onClick={() => handleInstantLogin('budisiregar@cargotrace.id')}
                className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#2F6BFF] bg-white text-[12px] font-semibold text-[#1E293B] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
                <span>Operator Desk</span>
              </button>
            </div>
          </div>

          {/* Bottom Footer Link */}
          <div className="text-center text-[12px] text-[#64748B] pt-4">
            Testing Customer isolation?{' '}
            <button
              type="button"
              onClick={() => handleInstantLogin('ayu@nusantararetail.co.id')}
              className="font-bold text-[#2F6BFF] hover:underline cursor-pointer"
            >
              Sign in as Customer
            </button>{' '}
            · Full list in <code className="font-semibold text-[#072D59]">README.md</code>
          </div>
        </div>
      </div>
    </div>
  );
};
