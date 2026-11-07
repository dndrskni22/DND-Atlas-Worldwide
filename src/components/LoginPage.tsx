import React, { useState } from 'react';
import { User } from '../types/cargotrace';
import { Anchor, ArrowRight, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Please enter your institutional email address.');
      return;
    }

    if (!password || password.trim().length < 4) {
      setErrorMessage('Please enter your account password (minimum 4 characters).');
      return;
    }

    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      setErrorMessage(
        'No CargoTrace account found for this email address. Please check the registered credentials in README.md.'
      );
      return;
    }

    onLoginSuccess(matchedUser);
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7FB] text-[#1E293B] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Architectural Brand Column */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#072D59] text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#DBF2FC] text-[#072D59] flex items-center justify-center">
              <Anchor className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <span className="text-[19px] font-bold tracking-tight text-white">
              CargoTrace
            </span>
          </div>

          <div className="mt-16 max-w-md space-y-4">
            <p className="text-[12px] font-semibold tracking-wider uppercase text-[#9BD4F0]">
              Global Shipment Visibility Platform
            </p>
            <h1 className="text-[30px] font-bold leading-[1.2] tracking-tight text-white">
              Unified operational control across sea, air, and overland freight corridors.
            </h1>
            <p className="text-[14px] text-[#DBF2FC]/85 leading-relaxed">
              Monitor multimodal shipments, verify chronological checkpoint milestones, evaluate deterministic arrival schedules, and manage customs or port exceptions from a single workspace.
            </p>
          </div>
        </div>

        {/* Bottom Corridor Summary Strip */}
        <div className="pt-8 border-t border-white/15 grid grid-cols-3 gap-6 text-[12px]">
          <div>
            <div className="text-[#9BD4F0] font-medium">Transport Modes</div>
            <div className="text-[15px] font-bold text-white mt-0.5 tabular-nums">
              Sea · Air · Road
            </div>
          </div>
          <div>
            <div className="text-[#9BD4F0] font-medium">Primary Corridor</div>
            <div className="text-[15px] font-bold text-white mt-0.5">
              SE Asia → Europe
            </div>
          </div>
          <div>
            <div className="text-[#9BD4F0] font-medium">Access Control</div>
            <div className="text-[15px] font-bold text-white mt-0.5">
              Server RBAC
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] bg-white border border-[#DCE4F0] rounded-xl p-8 shadow-xs">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#072D59] text-[#DBF2FC] flex items-center justify-center">
              <Anchor className="w-4 h-4" />
            </div>
            <span className="text-[17px] font-bold text-[#072D59] tracking-tight">
              CargoTrace
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-[22px] font-bold text-[#072D59] tracking-tight">
              Sign in to CargoTrace
            </h2>
            <p className="text-[13.5px] text-[#475569] mt-1">
              Enter your registered email and password to access your logistics workspace.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FFF0F3] border border-[#FD6E88] text-[#9F1D35] text-[12.5px] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-[#FD6E88] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-[12.5px] font-semibold text-[#1E293B] mb-1.5"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@cargotrace.id"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-10 pr-3.5 py-2.5 text-[13.5px] text-[#072D59] placeholder:text-[#94A3B8] focus:bg-white focus:border-[#072D59] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[12.5px] font-semibold text-[#1E293B] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-10 pr-10 py-2.5 text-[13.5px] text-[#072D59] placeholder:text-[#94A3B8] focus:bg-white focus:border-[#072D59] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
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

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-[#072D59] hover:bg-[#051F3E] text-white text-[13.5px] font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E2E8F0] text-[12px] text-[#475569] leading-relaxed">
            Account credentials for Administrator, Logistics Operator, and Customer roles are documented in <span className="font-mono-tabular font-semibold text-[#072D59]">README.md</span>.
          </div>
        </div>
      </div>
    </div>
  );
};
