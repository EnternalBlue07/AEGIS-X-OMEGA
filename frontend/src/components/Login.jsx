import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, RefreshCw, AlertOctagon } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const personas = [
    { name: 'Priya', role: 'Analyst', email: 'priya@aegisx.io', pass: 'analyst_priya' },
    { name: 'Rahul', role: 'Compliance', email: 'rahul@aegisx.io', pass: 'compliance_rahul' },
    { name: 'Meera', role: 'Operations', email: 'meera@aegisx.io', pass: 'ops_meera' },
    { name: 'Dev', role: 'Risk Eng.', email: 'dev@aegisx.io', pass: 'risk_engineer' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPersona = (p) => {
    setEmail(p.email);
    setPassword(p.pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-ink-base flex items-center justify-center p-4">
      {/* Dossier Terminal Frame */}
      <div className="w-full max-w-md bg-ink-base border border-ledger-blue/20 hairline-all rounded-lg p-6 relative overflow-hidden shadow-2xl">
        
        {/* Border Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-alert-rust via-evidence-gold to-ledger-blue"></div>

        {/* Rotated Stenciled Stamp Badge */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-evidence-gold fill-evidence-gold/10" />
            <div>
              <h2 className="text-md font-display font-extrabold tracking-widest text-zinc-50 uppercase">AEGIS-X</h2>
              <p className="text-[8px] text-ledger-blue font-mono tracking-widest uppercase font-semibold">FINANCIAL CRIME OS</p>
            </div>
          </div>
          <div className="stamp stamp-rust text-[9px]">
            SECURITY: EXTREME
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6 pb-4 border-b border-ledger-blue/10">
          <h3 className="text-xs font-mono font-bold text-ledger-blue uppercase tracking-wider">SYSTEM SIGN-IN // OPERATOR SESSION</h3>
          <p className="text-[9px] text-zinc-400 font-sans mt-0.5">Authorization token will expire automatically after 1 hour of inactivity.</p>
        </div>

        {error && (
          <div className="mb-4 bg-alert-rust/10 border border-alert-rust/30 text-alert-rust p-3 rounded-lg flex items-start gap-2 text-[10px] font-mono">
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase block">Access Denied</span>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          
          {/* Email input */}
          <div>
            <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ledger-blue mb-1">
              Email Address
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-ledger-blue absolute left-3 top-3" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@aegisx.io"
                className="w-full bg-ink-base border border-ledger-blue/20 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-ledger-blue/30 focus:outline-none focus:border-evidence-gold transition-colors"
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-[9px] font-display font-bold uppercase tracking-wider text-ledger-blue mb-1">
              Secure Key (Password)
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-ledger-blue absolute left-3 top-3" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-ink-base border border-ledger-blue/20 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-ledger-blue/30 focus:outline-none focus:border-evidence-gold transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ledger-blue/10 border border-ledger-blue/20 hover:bg-ledger-blue/20 text-evidence-gold rounded-lg font-display font-bold tracking-widest uppercase text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                VERIFYING DOSSIER KEYS...
              </>
            ) : (
              'AUTHORIZE OPERATOR'
            )}
          </button>

        </form>

        {/* Persona quick logins */}
        <div className="mt-6 border-t border-ledger-blue/15 pt-4">
          <span className="block text-[8px] font-mono text-ledger-blue uppercase tracking-wider mb-2.5">
            QUICK ACCESS PERSONAS // ENCRYPTED MOCK KEYS:
          </span>
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            {personas.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleSelectPersona(p)}
                className={`px-2.5 py-1.5 border rounded text-left transition-all duration-150 cursor-pointer ${
                  email === p.email
                    ? 'bg-ledger-blue/10 border-evidence-gold text-evidence-gold'
                    : 'bg-[#131924]/40 border-ledger-blue/10 text-ledger-blue hover:bg-ledger-blue/5 hover:text-zinc-200'
                }`}
              >
                <div className="font-extrabold uppercase text-[8px] tracking-wide">{p.name}</div>
                <div className="text-[8px] opacity-75">{p.role}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
