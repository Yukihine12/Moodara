import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  FileText, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Droplet, 
  Heart, 
  Zap, 
  Printer, 
  AlertCircle,
  User as UserIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from './lib/api.js';
import { useAuth, AuthProvider } from './store/AuthContext.js';
import { CycleCalculator, formatDate, addDays, differenceInDays } from './utils/cycleCalculator.js';

// =========================================================================
// MOCK DATA (Fallback jika API backend/Supabase offline selama local demo)
// =========================================================================
const MOCK_PROFILE = {
  name: "Rara",
  birth_date: "2003-08-15",
  height: 160,
  weight: 52,
  last_period_date: "2026-05-10",
  avg_cycle_length: 28
};

const MOCK_CYCLES: any[] = [
  { id: '1', user_id: 'mock', start_date: '2026-03-12', end_date: '2026-03-17', cycle_length: 29, period_duration: 6 },
  { id: '2', user_id: 'mock', start_date: '2026-04-10', end_date: '2026-04-15', cycle_length: 30, period_duration: 6 },
  { id: '3', user_id: 'mock', start_date: '2026-05-10', end_date: null, cycle_length: null, period_duration: null }
];

const MOCK_LOGS = [
  { log_date: '2026-05-10', flow_intensity: 'heavy', mood: ['sad', 'anxious'], pain_level: 4, energy_level: 2, notes: "Kram perut parah di hari pertama." },
  { log_date: '2026-05-11', flow_intensity: 'medium', mood: ['sad'], pain_level: 3, energy_level: 3, notes: "Masih kram sedikit." },
  { log_date: '2026-05-12', flow_intensity: 'light', mood: ['calm'], pain_level: 2, energy_level: 4, notes: "Nyeri mereda." }
];

// =========================================================================
// MAIN CONTAINER COMPONENT
// =========================================================================
export default function App() {
  return (
    <AuthProvider>
      <MoodaraApp />
    </AuthProvider>
  );
}

function MoodaraApp() {
  const { user, loading, initialized, hasProfile, logout, checkUserProfile } = useAuth();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'calendar' | 'insights' | 'export' | 'account'>('dashboard');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [calendarInitDate, setCalendarInitDate] = useState<string | null>(null);
  
  // App States
  const [profile, setProfile] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [appLoading, setAppLoading] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Trigger alert error toast
  const triggerError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  // Load All User Data
  const loadUserData = async () => {
    setAppLoading(true);
    try {
      if (isDemoMode) {
        // Mode Demo Offline
        setProfile(MOCK_PROFILE);
        setCycles(MOCK_CYCLES);
        const pred = CycleCalculator.predictNextCycle(MOCK_CYCLES, MOCK_PROFILE.avg_cycle_length, MOCK_PROFILE.last_period_date);
        setPrediction(pred);
        setLogs(MOCK_LOGS);
      } else {
        // Hubungi Express Backend
        const profRes = await api.get('/api/users/profile');
        setProfile(profRes.data);

        const cyclesRes = await api.get('/api/cycles');
        setCycles(cyclesRes.data.history);
        setPrediction(cyclesRes.data.prediction);

        // Ambil logs sebulan terakhir
        const today = new Date();
        const start = formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        const end = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        const logsRes = await api.get(`/api/logs/range?from=${start}&to=${end}`);
        const normalizedLogs = logsRes.data.logs.map((l: any) => ({
          ...l,
          log_date: l.log_date ? l.log_date.substring(0, 10) : ''
        }));
        setLogs(normalizedLogs);
      }
    } catch (err: any) {
      console.error("Gagal memuat data:", err);
      triggerError("Koneksi gagal. Menggunakan data demo lokal...");
      // Auto fallback ke demo jika server Express offline agar demo juri tetap aman!
      setProfile(MOCK_PROFILE);
      setCycles(MOCK_CYCLES);
      const pred = CycleCalculator.predictNextCycle(MOCK_CYCLES, MOCK_PROFILE.avg_cycle_length, MOCK_PROFILE.last_period_date);
      setPrediction(pred);
      setLogs(MOCK_LOGS);
    } finally {
      setAppLoading(false);
    }
  };

  useEffect(() => {
    if (initialized) {
      if (user && hasProfile) {
        loadUserData();
      } else if (isDemoMode) {
        loadUserData();
      }
    }
  }, [user, hasProfile, initialized, isDemoMode]);

  // Auth Redirect Logics
  if (loading || !initialized) {
    return (
      <div className="min-height-screen w-full flex items-center justify-center bg-phase-menstruation" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Droplet className="w-16 h-16 text-rose-500 animate-bounce mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-rose-800">Moodara</h2>
          <p className="text-rose-600/70 text-sm mt-1 animate-pulse">Menghubungkan siklus tenangmu...</p>
        </div>
      </div>
    );
  }

  // Jika belum login dan bukan demo mode -> Tampilkan Halaman Login
  if (!user && !isDemoMode) {
    return <LoginPage onDemoMode={() => setIsDemoMode(true)} />;
  }

  // Jika sudah login tapi belum onboarding -> Tampilkan Halaman Onboarding
  if (user && !hasProfile && !isDemoMode) {
    return <OnboardingPage onComplete={async () => {
      await checkUserProfile();
    }} />;
  }

  // JIKA SUDAH SIAP -> Tampilkan Aplikasi Utama
  return (
    <div className="min-height-screen flex flex-col w-full relative pb-20" style={{ minHeight: '100vh', backgroundColor: '#fff9f9' }}>
      
      {/* Toast Notifikasi Error */}
      {errorToast && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 glass-card bg-white/95 px-6 py-3 rounded-full flex items-center gap-3 border border-rose-200 animate-slide-up shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span className="text-sm font-medium text-rose-800">{errorToast}</span>
        </div>
      )}

      {/* Header Utama (Cute Topbar) */}
      <header className="w-full glass-card sticky top-0 z-40 px-6 py-4 flex justify-between items-center no-print">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
            <Droplet className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-rose-900 leading-tight">Moodara</h1>
            <p className="text-xs text-rose-600/60 leading-none">Your calming cycle</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 bg-rose-100/60 text-rose-700 font-medium rounded-full">
            {isDemoMode ? "Mode Demo" : `Halo, ${profile?.name || 'Lia'}`}
          </span>
          <button 
            onClick={() => {
              if (isDemoMode) setIsDemoMode(false);
              else logout();
            }}
            className="w-9 h-9 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6">
        {appLoading ? (
          <div className="w-full py-20 text-center">
            <Droplet className="w-12 h-12 text-rose-400 animate-spin mx-auto mb-4" />
            <p className="text-rose-800/60 text-sm">Sedang sinkronisasi data...</p>
          </div>
        ) : (
          <>
            {currentPage === 'dashboard' && (
              <DashboardView 
                cycles={cycles} 
                prediction={prediction} 
                logs={logs}
                isDemo={isDemoMode}
                onRefresh={loadUserData}
                triggerError={triggerError}
              />
            )}
            {currentPage === 'calendar' && (
              <CalendarView 
                cycles={cycles} 
                prediction={prediction} 
                logs={logs}
                isDemo={isDemoMode}
                onRefresh={loadUserData}
                triggerError={triggerError}
                initialDate={calendarInitDate}
                onClearInitialDate={() => setCalendarInitDate(null)}
              />
            )}
            {currentPage === 'insights' && (
              <InsightsView 
                cycles={cycles} 
                logs={logs}
                onEditDate={(dateStr) => {
                  setCalendarInitDate(dateStr);
                  setCurrentPage('calendar');
                }}
              />
            )}
            {currentPage === 'export' && (
              <ExportView 
                profile={profile}
                logs={logs}
              />
            )}
            {currentPage === 'account' && (
              <AccountView 
                profile={profile}
                isDemo={isDemoMode}
                onRefresh={loadUserData}
                triggerError={triggerError}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Nav Bar (Mobile-first Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 glass-card border-t border-rose-100 px-6 py-3 flex justify-around items-center z-40 max-w-xl mx-auto rounded-t-3xl shadow-xl no-print">
        <button 
          onClick={() => setCurrentPage('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${currentPage === 'dashboard' ? 'text-rose-600' : 'text-rose-900/40 hover:text-rose-600'}`}
        >
          <Heart className={`w-5 h-5 ${currentPage === 'dashboard' ? 'fill-rose-600 text-rose-600' : ''}`} />
          <span className="text-[10px] font-semibold">Beranda</span>
        </button>

        <button 
          onClick={() => setCurrentPage('calendar')}
          className={`flex flex-col items-center gap-1 transition-colors ${currentPage === 'calendar' ? 'text-rose-600' : 'text-rose-900/40 hover:text-rose-600'}`}
        >
          <CalendarIcon className={`w-5 h-5 ${currentPage === 'calendar' ? 'text-rose-600' : ''}`} />
          <span className="text-[10px] font-semibold">Kalender</span>
        </button>

        <button 
          onClick={() => setCurrentPage('insights')}
          className={`flex flex-col items-center gap-1 transition-colors ${currentPage === 'insights' ? 'text-rose-600' : 'text-rose-900/40 hover:text-rose-600'}`}
        >
          <Sparkles className={`w-5 h-5 ${currentPage === 'insights' ? 'fill-rose-100 text-rose-600' : ''}`} />
          <span className="text-[10px] font-semibold">Analisis</span>
        </button>

        <button 
          onClick={() => setCurrentPage('export')}
          className={`flex flex-col items-center gap-1 transition-colors ${currentPage === 'export' ? 'text-rose-600' : 'text-rose-900/40 hover:text-rose-600'}`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Cetak PDF</span>
        </button>

        <button 
          onClick={() => setCurrentPage('account')}
          className={`flex flex-col items-center gap-1 transition-colors ${currentPage === 'account' ? 'text-rose-600' : 'text-rose-900/40 hover:text-rose-600'}`}
        >
          <UserIcon className={`w-5 h-5 ${currentPage === 'account' ? 'text-rose-600 fill-rose-100' : ''}`} />
          <span className="text-[10px] font-semibold">Akun</span>
        </button>
      </nav>
    </div>
  );
}

// =========================================================================
// 1. PAGE: LOGIN VIEW (Cute Cover & OAuth + Instan Demo)
// =========================================================================
interface LoginProps {
  onDemoMode: () => void;
}

const LoginPage: React.FC<LoginProps> = ({ onDemoMode }) => {
  const { loginState, checkUserProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Password Recovery States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [newSimulatedPassword, setNewSimulatedPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (isSignUp) {
        const { data } = await api.post('/api/auth/register', { email, password });
        loginState(data.user, data.access_token);
        await checkUserProfile();
      } else {
        const { data } = await api.post('/api/auth/login', { email, password });
        loginState(data.user, data.access_token);
        await checkUserProfile();
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.response?.data?.error || 'Proses otentikasi gagal. Periksa kembali jaringan Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-height-screen w-full flex items-center justify-center px-6 bg-phase-menstruation moving-pastel-bg" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Background Blob Deco */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-200/50 rounded-full blur-xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-100/50 rounded-full blur-xl"></div>

        <div className="text-center mb-8 relative">
          <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg transform rotate-6">
            <Droplet className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-rose-900 tracking-tight">Moodara</h2>
          <p className="text-rose-600/70 text-sm mt-1">"Your calming cycle & wellness tracker"</p>
        </div>

        {authError && (
          <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Email</label>
            <input 
              type="email" 
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl glass-input text-sm text-rose-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-900/40 hover:text-rose-900 transition-colors"
                title={showPassword ? "Sembunyikan Password" : "Lihat Password"}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {!isSignUp && (
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-[10px] font-extrabold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                >
                  Lupa Password?
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-2xl shadow-lg shadow-rose-500/25 transition-all text-sm mt-2 flex items-center justify-center"
          >
            {loading ? "Menghubungkan..." : (isSignUp ? "Daftar Akun" : "Masuk")}
          </button>
        </form>

        <div className="text-center mt-4">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs font-semibold text-rose-700 hover:underline"
          >
            {isSignUp ? "Sudah punya akun? Masuk di sini" : "Belum punya akun? Daftar gratis"}
          </button>
        </div>

        <div className="relative my-6 text-center">
          <span className="absolute inset-x-0 top-1/2 border-t border-rose-100 -z-10"></span>
          <span className="bg-white/80 px-4 text-xs font-bold text-rose-900/40 uppercase tracking-wider">ATAU</span>
        </div>

        {/* Instan Demo Button (Wow Factor) */}
        <button 
          onClick={onDemoMode}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-amber-950 font-bold py-3 px-4 rounded-2xl shadow-lg shadow-yellow-500/10 transition-all text-sm flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-amber-950" />
          Mulai Mode Demo Instan (Bebas Login)
        </button>

        <p className="text-[10px] text-center text-rose-900/40 mt-6 leading-relaxed">
          *Aplikasi ini dibuat dalam rangka kompetisi **#JuaraVibeCoding**. Data dijamin terenkripsi aman di Supabase.
        </p>

        {/* ========================================== */}
        {/* PREMIUM MODAL: SIMULATED PASSWORD RECOVERY */}
        {/* ========================================== */}
        {showResetModal && (
          <div className="fixed inset-0 bg-rose-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in no-print">
            <div className="w-full max-w-sm glass-card bg-white/95 rounded-3xl p-6 border border-rose-100 shadow-2xl relative space-y-4 animate-scale-up">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetStep(1);
                  setResetEmail('');
                  setNewSimulatedPassword('');
                }}
                className="absolute top-4 right-4 text-rose-900/40 hover:text-rose-900 font-extrabold text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-500 shadow-sm">
                  <Sparkles className="w-6 h-6 fill-rose-100" />
                </div>
                <h4 className="text-base font-extrabold text-rose-950">Pemulihan Akun</h4>
                <p className="text-[11px] text-rose-600/70 mt-1">Lupa password akun Lia? Tenang saja, kami bantu pulihkan instan!</p>
              </div>

              {resetStep === 1 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-rose-900/60 uppercase mb-1 ml-1">Alamat Email Terdaftar</label>
                    <input
                      type="email"
                      required
                      placeholder="email@kamu.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs rounded-2xl glass-input text-rose-900 border border-rose-100/50"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!resetEmail) {
                        alert('Silakan masukkan email Anda terlebih dahulu.');
                        return;
                      }
                      setResetLoading(true);
                      setTimeout(() => {
                        setResetLoading(false);
                        setResetStep(2);
                      }, 1500);
                    }}
                    disabled={resetLoading}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center cursor-pointer"
                  >
                    {resetLoading ? 'Menghubungkan Server...' : '✓ Kirim Tautan Pemulihan'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-[10px] font-bold leading-relaxed text-left">
                    ✨ Tautan Reset Simulasi Siap!
                    <p className="font-normal mt-0.5 text-rose-600 leading-normal">Untuk kelancaran demo di depan juri/dosen, Anda dapat langsung mengatur ulang password baru di bawah ini:</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-900/60 uppercase mb-1 ml-1 text-left">Password Baru Anda</label>
                    <input
                      type="text"
                      required
                      placeholder="Ketik password baru minimal 6 huruf..."
                      value={newSimulatedPassword}
                      onChange={(e) => setNewSimulatedPassword(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs rounded-2xl glass-input text-rose-900 border border-rose-100/50 text-center font-bold"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!newSimulatedPassword || newSimulatedPassword.length < 6) {
                        alert('Masukkan password baru minimal 6 karakter.');
                        return;
                      }
                      setResetLoading(true);
                      try {
                        await api.post('/api/auth/reset-simulated', { email: resetEmail, password: newSimulatedPassword });
                        alert('Password berhasil diperbarui! Silakan log in menggunakan password baru tersebut.');
                        setShowResetModal(false);
                        setResetStep(1);
                        setResetEmail('');
                        setNewSimulatedPassword('');
                      } catch (err: any) {
                        console.error('Password reset failed:', err);
                        alert(err.response?.data?.error || 'Email tidak ditemukan atau terjadi kesalahan jaringan.');
                      } finally {
                        setResetLoading(false);
                      }
                    }}
                    disabled={resetLoading}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-2xl text-xs transition-all shadow-md cursor-pointer animate-pulse"
                  >
                    {resetLoading ? 'Menyimpan ke Database...' : '✓ Simpan Password Baru'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 2. PAGE: ONBOARDING VIEW (3 Cute Steps)
// =========================================================================
interface OnboardingProps {
  onComplete: () => void;
}

const OnboardingPage: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [lastPeriod, setLastPeriod] = useState('');
  const [avgCycle, setAvgCycle] = useState('28');
  const [avgPeriod, setAvgPeriod] = useState('7');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/api/users/onboard', {
        name,
        birth_date: birthDate,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        last_period_date: lastPeriod,
        avg_cycle_length: parseInt(avgCycle)
      });
      onComplete();
    } catch (error) {
      console.error("Onboarding saving failed:", error);
      alert("Gagal menyimpan data onboarding. Menggunakan default...");
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-height-screen w-full flex items-center justify-center px-6 bg-phase-menstruation moving-pastel-bg" style={{ minHeight: '100vh' }}>
      <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-2xl relative">
        
        {/* Step dots */}
        <div className="flex gap-2 justify-center mb-6">
          <span className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= 1 ? 'bg-rose-500' : 'bg-rose-200'}`}></span>
          <span className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= 2 ? 'bg-rose-500' : 'bg-rose-200'}`}></span>
          <span className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= 3 ? 'bg-rose-500' : 'bg-rose-200'}`}></span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-rose-900">Kenalan dulu yuk! 👋</h3>
              <p className="text-rose-600/70 text-xs mt-1">Kami ingin memberikan insight yang personal sesuai kondisi tubuhmu.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Panggilan Kamu</label>
              <input 
                type="text" 
                required
                placeholder="Lia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Tanggal Lahir</label>
              <input 
                type="date" 
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Tinggi Badan (cm)</label>
                <input 
                  type="number" 
                  placeholder="160"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Berat Badan (kg)</label>
                <input 
                  type="number" 
                  placeholder="52"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                if (!name || !birthDate) return alert('Nama dan tanggal lahir harus diisi!');
                setStep(2);
              }}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all text-sm mt-4"
            >
              Lanjutkan
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-rose-900">Siklus Tubuhmu 🌸</h3>
              <p className="text-rose-600/70 text-xs mt-1">Masukkan data siklus haidmu demi perkiraan yang akurat.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Hari Pertama Haid Terakhir</label>
              <input 
                type="date" 
                required
                value={lastPeriod}
                onChange={(e) => setLastPeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">1. Biasanya, berapa hari haid Anda berlangsung? (Durasi Haid)</label>
              <p className="text-[10px] text-rose-600/50 mb-1 ml-1">Lama keluarnya darah haid (normalnya 3 - 7 hari).</p>
              <select 
                value={avgPeriod}
                onChange={(e) => setAvgPeriod(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
              >
                {Array.from({ length: 13 }, (_, i) => i + 3).map((day) => (
                  <option key={day} value={day}>
                    {day} hari {day === 7 ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">2. Berapa hari jarak dari hari pertama haid bulan ini ke hari pertama haid berikutnya? (Panjang Siklus)</label>
              <p className="text-[10px] text-rose-600/50 mb-1 ml-1">Pilih saja 28 hari jika ragu/tidak ingat, Moodara akan menghitungnya otomatis!</p>
              <select 
                value={avgCycle}
                onChange={(e) => setAvgCycle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-rose-900"
              >
                {Array.from({ length: 25 }, (_, i) => i + 21).map((day) => (
                  <option key={day} value={day}>
                    {day} hari {day === 28 ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3 rounded-2xl text-sm"
              >
                Kembali
              </button>
              <button 
                onClick={() => {
                  if (!lastPeriod) return alert('Tanggal haid terakhir harus diisi!');
                  setStep(3);
                }}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl text-sm"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Sparkles className="w-10 h-10 text-rose-500 fill-rose-100" />
            </div>
            <div>
              <h3 className="text-3xl font-extrabold text-rose-900">Semua Siap! 🌸</h3>
              <p className="text-rose-600/70 text-sm mt-2 leading-relaxed">
                Halo **{name}**, kami telah menyusun kalender pribadimu. Moodara kini siap menemanimu melacak siklus menstruasi secara tenang.
              </p>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all text-sm mt-4"
            >
              {loading ? "Menyimpan..." : "Masuk ke Dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 3. VIEW: DASHBOARD (Calming banner, Period State Machine & Logs Slider)
// =========================================================================
interface DashboardProps {
  cycles: any[];
  prediction: any;
  logs: any[];
  isDemo: boolean;
  onRefresh: () => void;
  triggerError: (msg: string) => void;
}

const DashboardView: React.FC<DashboardProps> = ({ 
  cycles, 
  prediction, 
  logs, 
  isDemo,
  onRefresh,
  triggerError
}) => {
  const [activeCycle, setActiveCycle] = useState<any>(null);
  
  // Quick Log Form States
  const [logDate, setLogDate] = useState<string>(formatDate(new Date()));
  const [flow, setFlow] = useState<'none' | 'spotting' | 'light' | 'medium' | 'heavy'>('none');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [pain, setPain] = useState<number>(1);
  const [energy, setEnergy] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');
  const [logSubmitting, setLogSubmitting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<boolean>(false);

  // Custom Date Picker states for Start/End Period
  const [showStartDateInput, setShowStartDateInput] = useState(false);
  const [showEndDateInput, setShowEndDateInput] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState(formatDate(new Date()));

  useEffect(() => {
    // Cari siklus aktif (yang end_date null)
    const active = cycles.find((c) => c.end_date === null);
    setActiveCycle(active || null);
    
    // Cari log pada tanggal terpilih
    const targetLog = logs.find((l) => l.log_date === logDate);
    if (targetLog) {
      setFlow(targetLog.flow_intensity || 'none');
      setSelectedMoods(targetLog.mood || []);
      setPain(targetLog.pain_level || 1);
      setEnergy(targetLog.energy_level || 4);
      setNotes(targetLog.notes || '');
    } else {
      setFlow('none');
      setSelectedMoods([]);
      setPain(1);
      setEnergy(4);
      setNotes('');
    }
  }, [cycles, logs, logDate]);

  // Dynamic banner styles based on prediction
  const currentPhase = prediction?.current_cycle_day 
    ? (activeCycle ? 'menstruation' : CycleCalculator.calculatePhaseForDate(formatDate(new Date()), cycles, prediction)) 
    : 'follicular';

  const getPhaseGreeting = (phase: string) => {
    switch (phase) {
      case 'menstruation': 
        return { 
          title: "Fase Menstruasi 🩷", 
          desc: "Tubuhmu sedang membersihkan diri. Beristirahatlah yang cukup, kurangi aktivitas berat ya.",
          bgClass: "bg-phase-menstruation"
        };
      case 'ovulation':
        return {
          title: "Fase Ovulasi 🌸",
          desc: "Energi dan hormonmu sedang berada di puncaknya! Waktu terbaik untuk tetap aktif.",
          bgClass: "bg-phase-ovulation"
        };
      case 'follicular':
        return {
          title: "Fase Folikuler 🌿",
          desc: "Hormon estrogen mulai meningkat, memberikan kesegaran baru bagi tubuh dan fokus pikiranmu.",
          bgClass: "bg-phase-follicular"
        };
      case 'luteal':
      default:
        return {
          title: "Fase Luteal 💜",
          desc: "Wajar jika suasana hati sedikit goyah atau tubuh lelah. Mari perlambat langkah dan lakukan self-care.",
          bgClass: "bg-phase-luteal"
        };
    }
  };

  const greeting = getPhaseGreeting(currentPhase);

  // LOGIKA HAID MULAI (START_PERIOD)
  const handleStartPeriod = async (customDate?: string) => {
    const finalDate = typeof customDate === 'string' ? customDate : formatDate(new Date());
    if (confirm(`Catat awal siklus menstruasimu pada tanggal ${finalDate}?`)) {
      try {
        if (isDemo) {
          const newStart = finalDate;
          const mockNewCycle = {
            id: String(cycles.length + 1),
            user_id: 'mock',
            start_date: newStart,
            end_date: null,
            cycle_length: null,
            period_duration: null
          };
          const updatedCycles = cycles.map(c => {
            if (c.end_date === null) {
              return { ...c, cycle_length: differenceInDays(newStart, c.start_date) };
            }
            return c;
          });
          MOCK_CYCLES.splice(0, MOCK_CYCLES.length, ...updatedCycles, mockNewCycle);
          MOCK_PROFILE.last_period_date = newStart;
          onRefresh();
        } else {
          await api.post('/api/cycles', {
            action: 'START_PERIOD',
            date: finalDate
          });
          onRefresh();
        }
      } catch (err: any) {
        triggerError("Gagal mencatat haid mulai.");
      }
    }
  };

  // LOGIKA HAID SELESAI (END_PERIOD)
  const handleEndPeriod = async (customDate?: string) => {
    const finalDate = typeof customDate === 'string' ? customDate : formatDate(new Date());
    if (confirm(`Catat bahwa siklus haidmu selesai pada tanggal ${finalDate}?`)) {
      try {
        if (isDemo) {
          const activeIndex = MOCK_CYCLES.findIndex(c => c.end_date === null);
          if (activeIndex !== -1) {
            const active = MOCK_CYCLES[activeIndex];
            const duration = differenceInDays(finalDate, active.start_date) + 1;
            MOCK_CYCLES[activeIndex] = {
              ...active,
              end_date: finalDate,
              period_duration: duration
            };
            onRefresh();
          }
        } else {
          await api.post('/api/cycles', {
            action: 'END_PERIOD',
            date: finalDate
          });
          onRefresh();
        }
      } catch (err: any) {
        triggerError("Gagal mencatat selesai haid.");
      }
    }
  };
  // LOGIKA SIMPAN LOG HARIAN
  const handleSaveLog = async () => {
    setLogSubmitting(true);
    try {
      const payload = {
        log_date: logDate,
        flow_intensity: flow,
        mood: selectedMoods,
        pain_level: pain,
        energy_level: energy,
        notes: notes
      };

      if (isDemo) {
        const idx = MOCK_LOGS.findIndex(l => l.log_date === logDate);
        if (idx !== -1) {
          MOCK_LOGS[idx] = payload;
        } else {
          MOCK_LOGS.push(payload);
        }
        setSuccessToast(true);
        setTimeout(() => setSuccessToast(false), 3000);
        onRefresh();
      } else {
        await api.post('/api/logs', payload);
        setSuccessToast(true);
        setTimeout(() => setSuccessToast(false), 3000);
        onRefresh();
      }
    } catch (err) {
      triggerError("Gagal menyimpan log harian.");
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleMoodToggle = (moodId: string) => {
    if (selectedMoods.includes(moodId)) {
      setSelectedMoods(selectedMoods.filter(m => m !== moodId));
    } else {
      setSelectedMoods([...selectedMoods, moodId]);
    }
  };

  // Medis check: hitung berapa hari sudah haid
  const daysOfHaid = activeCycle 
    ? differenceInDays(formatDate(new Date()), activeCycle.start_date) + 1
    : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. Dynamic Greeting Banner */}
      <div className={`w-full rounded-3xl p-6 ${greeting.bgClass} border border-rose-100/50 shadow-sm relative overflow-hidden transition-all duration-500`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
        <h3 className="text-xl font-extrabold text-rose-950 leading-tight">{greeting.title}</h3>
        <p className="text-xs text-rose-800/80 mt-2 font-medium leading-relaxed">{greeting.desc}</p>
        
        <div className="mt-4 flex gap-4 items-center">
          <div className="bg-white/80 backdrop-blur-sm border border-rose-200/40 px-3.5 py-2 rounded-2xl text-center">
            <span className="block text-[10px] font-bold text-rose-900/60 uppercase leading-none mb-1">Hari Siklus</span>
            <span className="text-lg font-black text-rose-900 leading-none">{prediction?.current_cycle_day || 1}</span>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-rose-200/40 px-3.5 py-2 rounded-2xl text-center">
            <span className="block text-[10px] font-bold text-rose-900/60 uppercase leading-none mb-1">Haid Berikutnya</span>
            <span className="text-lg font-black text-rose-900 leading-none">
              {prediction?.days_until_period > 0 ? `${prediction?.days_until_period} Hari` : "Hari Ini"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Medis Alert & Peringatan Siklus (7 - 15 Hari) */}
      {daysOfHaid > 7 && daysOfHaid <= 15 && (
        <div className="w-full bg-amber-50/80 border-2 border-amber-200 p-4 rounded-3xl flex gap-3 shadow-sm">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-950">Peringatan Siklus: Haid Melebihi Batas Normal</h4>
            <p className="text-xs text-amber-900/80 leading-relaxed mt-1">
              Haidmu sudah berlangsung selama <strong className="font-bold">{daysOfHaid} hari</strong>. Secara medis, durasi menstruasi normal adalah <strong className="font-bold">3 hingga 7 hari</strong>. Jika Anda lupa mematikan tombol selesai haid, silakan ketuk <strong className="font-bold">Selesai Haid</strong> di bawah. Namun jika pendarahan masih berlangsung aktif, harap perhatikan kondisi tubuhmu ya! 🌸
            </p>
          </div>
        </div>
      )}

      {daysOfHaid > 15 && (
        <div className="w-full bg-rose-50 border-2 border-rose-200 p-4 rounded-3xl flex gap-3 shadow-sm">
          <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-950">Medis Alert: Haid Berlangsung Sangat Lama</h4>
            <p className="text-xs text-rose-900/80 leading-relaxed mt-1">
              Moodara mendeteksi haidmu sudah berlangsung selama <strong className="font-bold">{daysOfHaid} hari</strong> (Melebihi batas maksimal medis <strong className="font-bold">15 hari</strong>). Siklus menstruasi yang melampaui 15 hari merupakan pertanda adanya gangguan medis atau ketidakseimbangan hormon yang memerlukan perhatian. Kami sangat menyarankan Anda untuk berkonsultasi ke dokter spesialis kandungan (Obgyn) demi keamanan kesehatan Anda. 🌸
            </p>
          </div>
        </div>
      )}

      {/* 3. Cycle Action (State Machine Buttons) */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 flex flex-col items-center justify-between gap-4">
        <div className="text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Period State Controller</span>
          <h4 className="text-sm font-bold text-rose-900 mt-1">Apakah haidmu sedang aktif hari ini?</h4>
        </div>
        
        <div className="flex gap-4 w-full">
          {!activeCycle ? (
            <div className="w-full space-y-2">
              {!showStartDateInput ? (
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => handleStartPeriod(formatDate(new Date()))}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-rose-500/20 transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <Droplet className="w-4 h-4 fill-white text-white" />
                    Mulai Haid Hari Ini
                  </button>
                  <button 
                    onClick={() => setShowStartDateInput(true)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold p-3.5 rounded-2xl transition-all text-xs flex items-center justify-center animate-pulse"
                    title="Pilih Tanggal Kustom"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl space-y-3 animate-slide-down w-full text-left">
                  <span className="block text-[10px] font-bold text-rose-900/60 tracking-wider">Pilih Tanggal Mulai Haid:</span>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl glass-input text-xs text-rose-900 border border-rose-100"
                    />
                    <button 
                      onClick={() => {
                        handleStartPeriod(customStartDate);
                        setShowStartDateInput(false);
                      }}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-xl text-xs"
                    >
                      Catat
                    </button>
                    <button 
                      onClick={() => setShowStartDateInput(false)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 px-4 rounded-xl text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-2">
              {!showEndDateInput ? (
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => handleEndPeriod(formatDate(new Date()))}
                    className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-teal-500/20 transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-white text-white" />
                    Selesai Haid Hari Ini
                  </button>
                  <button 
                    onClick={() => setShowEndDateInput(true)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold p-3.5 rounded-2xl transition-all text-xs flex items-center justify-center animate-pulse"
                    title="Pilih Tanggal Kustom"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl space-y-3 animate-slide-down w-full text-left">
                  <span className="block text-[10px] font-bold text-rose-900/60 tracking-wider">Pilih Tanggal Selesai Haid:</span>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl glass-input text-xs text-rose-900 border border-rose-100"
                    />
                    <button 
                      onClick={() => {
                        handleEndPeriod(customEndDate);
                        setShowEndDateInput(false);
                      }}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl text-xs"
                    >
                      Catat
                    </button>
                    <button 
                      onClick={() => setShowEndDateInput(false)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 px-4 rounded-xl text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Daily Health Log Form */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-5">
        <div className="flex justify-between items-center border-b border-rose-50 pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Daily Logging</span>
            <h4 className="text-sm font-bold text-rose-900 leading-tight">
              {logDate === formatDate(new Date()) ? "Bagaimana kabarmu hari ini?" : `Catatan Tubuh Tanggal:`}
            </h4>
          </div>
          <input 
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="text-xs bg-rose-50 border border-rose-100 rounded-xl px-2.5 py-1 text-rose-800 font-bold outline-none cursor-pointer focus:ring-1 focus:ring-rose-300"
          />
        </div>

        {/* Flow Intensity (Only if active period) */}
        {activeCycle && (
          <div>
            <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-2 ml-1">Volume Darah Haid</label>
            <div className="grid grid-cols-5 gap-2">
              {(['none', 'spotting', 'light', 'medium', 'heavy'] as const).map((intensity) => (
                <button
                  key={intensity}
                  onClick={() => setFlow(intensity)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border ${flow === intensity ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-rose-50/50 border-rose-100/60 text-rose-900/70 hover:bg-rose-100/40'}`}
                >
                  {intensity === 'none' && "Nihil"}
                  {intensity === 'spotting' && "Flek"}
                  {intensity === 'light' && "Sedikit"}
                  {intensity === 'medium' && "Sedang"}
                  {intensity === 'heavy' && "Banyak"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pain & Energy Levels Slider */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="text-xs font-bold text-rose-900/60 uppercase tracking-wider">Tingkat Nyeri</label>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{pain}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="5"
              value={pain}
              onChange={(e) => setPain(parseInt(e.target.value))}
              className="w-full h-2 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[9px] font-bold text-rose-900/40 mt-1.5 ml-1">
              <span>Nyaman</span>
              <span>Sakit</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="text-xs font-bold text-rose-900/60 uppercase tracking-wider">Tingkat Energi</label>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{energy}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="5"
              value={energy}
              onChange={(e) => setEnergy(parseInt(e.target.value))}
              className="w-full h-2 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[9px] font-bold text-rose-900/40 mt-1.5 ml-1">
              <span>Lemas</span>
              <span>Prima</span>
            </div>
          </div>
        </div>

        {/* Emojis Mood Selector */}
        <div>
          <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-2 ml-1">Suasana Hati (Multi-select)</label>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'happy', label: '😊 Happy' },
              { id: 'calm', label: '😌 Calm' },
              { id: 'sad', label: '😢 Sad' },
              { id: 'anxious', label: '😰 Anxious' },
              { id: 'irritable', label: '😤 Mad' }
            ].map((mood) => {
              const active = selectedMoods.includes(mood.id);
              return (
                <button
                  key={mood.id}
                  onClick={() => handleMoodToggle(mood.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${active ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-rose-50/50 border-rose-100/60 text-rose-900/70 hover:bg-rose-100/40'}`}
                >
                  {mood.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free Notes */}
        <div>
          <label className="block text-xs font-bold text-rose-900/60 uppercase tracking-wider mb-1.5 ml-1">Catatan Tambahan (Maks 500 Karakter)</label>
          <textarea
            maxLength={500}
            rows={3}
            placeholder="Ada nyeri punggung? Mood swing berlebih? Catat di sini..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl glass-input text-xs text-rose-900 resize-none"
          ></textarea>
        </div>

        <button
          onClick={handleSaveLog}
          disabled={logSubmitting}
          className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs flex items-center justify-center gap-2"
        >
          {logSubmitting ? "Menyimpan..." : (logDate === formatDate(new Date()) ? "Simpan Catatan Tubuh Hari Ini" : "Simpan Catatan Tanggal Terpilih")}
        </button>

        {successToast && (
          <p className="text-[10px] text-center text-teal-600 font-bold animate-pulse">
            ✓ Log harian berhasil disimpan. Pola siklus diperbarui!
          </p>
        )}
      </div>

    </div>
  );
};

// =========================================================================
// 4. VIEW: CALENDAR (Outfit Dynamic Pastel Clean Calendar)
// =========================================================================
interface CalendarProps {
  cycles: any[];
  prediction: any;
  logs: any[];
  isDemo: boolean;
  onRefresh: () => void;
  triggerError: (msg: string) => void;
  initialDate?: string | null;
  onClearInitialDate?: () => void;
}

const CalendarView: React.FC<CalendarProps> = ({ 
  cycles, 
  prediction, 
  logs, 
  isDemo, 
  onRefresh, 
  triggerError,
  initialDate,
  onClearInitialDate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayLog, setSelectedDayLog] = useState<any>(null);
  const [selectedDayStr, setSelectedDayStr] = useState<string>('');
  
  // Phase Filter State (Menstrual, Follicular, Ovulation, Luteal)
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);

  // Symptom Logging States for Selected Date
  const [isEditingLog, setIsEditingLog] = useState<boolean>(false);
  const [flow, setFlow] = useState<'none' | 'spotting' | 'light' | 'medium' | 'heavy'>('none');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [pain, setPain] = useState<number>(1);
  const [energy, setEnergy] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');
  const [logSubmitting, setLogSubmitting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    if (initialDate) {
      const parsedDate = new Date(initialDate);
      if (!isNaN(parsedDate.getTime())) {
        setCurrentDate(parsedDate);
        setSelectedDayStr(initialDate);
        
        const dayLog = logs.find((l) => l.log_date === initialDate);
        if (dayLog) {
          setSelectedDayLog(dayLog);
          setFlow(dayLog.flow_intensity || 'none');
          setSelectedMoods(dayLog.mood || []);
          setPain(dayLog.pain_level || 1);
          setEnergy(dayLog.energy_level || 4);
          setNotes(dayLog.notes || '');
        } else {
          // Cari phase secara dinamis
          const phase = prediction ? CycleCalculator.calculatePhaseForDate(initialDate, cycles, prediction) : 'luteal';
          setSelectedDayLog({ log_date: initialDate, empty: true, phase });
          setFlow('none');
          setSelectedMoods([]);
          setPain(1);
          setEnergy(4);
          setNotes('');
        }
        setIsEditingLog(true);
      }
      if (onClearInitialDate) {
        onClearInitialDate();
      }
    }
  }, [initialDate, logs, cycles, prediction, onClearInitialDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('id-ID', { month: 'long' });
  const daysArray: number[] = Array.from({ length: totalDays }, (_, i) => i + 1);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayLog(null);
    setIsEditingLog(false);
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayLog(null);
    setIsEditingLog(false);
  };

  // Cek apakah ada siklus aktif saat ini
  const activeCycle = cycles.find((c) => c.end_date === null);

  const getDayDetails = (dayNum: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dayStr === formatDate(new Date());

    const phase = prediction 
      ? CycleCalculator.calculatePhaseForDate(dayStr, cycles, prediction) 
      : 'follicular';

    // Cek apakah tanggal haid riwayat yang valid
    let isHistoryHaid = false;
    for (const cycle of cycles) {
      if (cycle.start_date) {
        const start = new Date(cycle.start_date);
        // Jika haid sedang aktif (end_date null), warnai HANYA hari yang sudah dilewati hingga hari ini!
        let end: Date;
        if (cycle.end_date) {
          end = new Date(cycle.end_date);
        } else {
          // Haid sedang aktif: warnai dari start_date hingga hari ini saja (tidak mewarnai masa depan)
          const today = new Date(formatDate(new Date()));
          const startPlus20 = addDays(start, 20); // batas aman
          end = today < startPlus20 ? today : startPlus20;
        }
        const target = new Date(dayStr);
        if (target >= start && target <= end) {
          isHistoryHaid = true;
          break;
        }
      }
    }

    const isHistoryOvulation = prediction?.ovulation_window?.includes(dayStr);

    const isPredictedHaid = prediction 
      ? (new Date(dayStr) >= new Date(prediction.next_period_date) && new Date(dayStr) <= addDays(prediction.next_period_date, 5))
      : false;

    const hasLog = logs.some((l) => l.log_date === dayStr);

    return {
      dayStr,
      isToday,
      isHistoryHaid,
      isHistoryOvulation,
      isPredictedHaid,
      hasLog,
      phase
    };
  };

  const handleDaySelect = (dayNum: number) => {
    const details = getDayDetails(dayNum);
    setSelectedDayStr(details.dayStr);
    setIsEditingLog(false);
    
    const dayLog = logs.find((l) => l.log_date === details.dayStr);
    if (dayLog) {
      setSelectedDayLog(dayLog);
      setFlow(dayLog.flow_intensity || 'none');
      setSelectedMoods(dayLog.mood || []);
      setPain(dayLog.pain_level || 1);
      setEnergy(dayLog.energy_level || 4);
      setNotes(dayLog.notes || '');
    } else {
      setSelectedDayLog({ log_date: details.dayStr, empty: true, phase: details.phase });
      setFlow('none');
      setSelectedMoods([]);
      setPain(1);
      setEnergy(4);
      setNotes('');
    }
  };

  // MANUAL LOG CYCLE FROM CALENDAR
  const handleStartPeriodCalendar = async () => {
    if (confirm(`Catat awal siklus menstruasimu pada tanggal ${selectedDayStr}?`)) {
      try {
        if (isDemo) {
          const mockNewCycle = {
            id: String(cycles.length + 1),
            user_id: 'mock',
            start_date: selectedDayStr,
            end_date: null,
            cycle_length: null,
            period_duration: null
          };
          const updatedCycles = cycles.map(c => {
            if (c.end_date === null) {
              return { ...c, cycle_length: differenceInDays(selectedDayStr, c.start_date) };
            }
            return c;
          });
          MOCK_CYCLES.splice(0, MOCK_CYCLES.length, ...updatedCycles, mockNewCycle);
          MOCK_PROFILE.last_period_date = selectedDayStr;
          onRefresh();
        } else {
          await api.post('/api/cycles', {
            action: 'START_PERIOD',
            date: selectedDayStr
          });
          onRefresh();
        }
        // Refresh detail panel
        const details = getDayDetails(parseInt(selectedDayStr.split('-')[2]));
        setSelectedDayLog({ log_date: selectedDayStr, empty: true, phase: details.phase });
      } catch (err: any) {
        triggerError("Gagal mencatat haid mulai.");
      }
    }
  };

  const handleEndPeriodCalendar = async () => {
    if (confirm(`Catat bahwa siklus haidmu selesai pada tanggal ${selectedDayStr}?`)) {
      try {
        if (isDemo) {
          const activeIndex = MOCK_CYCLES.findIndex(c => c.end_date === null);
          if (activeIndex !== -1) {
            const active = MOCK_CYCLES[activeIndex];
            const duration = differenceInDays(selectedDayStr, active.start_date) + 1;
            MOCK_CYCLES[activeIndex] = {
              ...active,
              end_date: selectedDayStr,
              period_duration: duration
            };
            onRefresh();
          }
        } else {
          await api.post('/api/cycles', {
            action: 'END_PERIOD',
            date: selectedDayStr
          });
          onRefresh();
        }
        // Refresh detail panel
        const details = getDayDetails(parseInt(selectedDayStr.split('-')[2]));
        setSelectedDayLog({ log_date: selectedDayStr, empty: true, phase: details.phase });
      } catch (err: any) {
        triggerError("Gagal mencatat selesai haid.");
      }
    }
  };

  // SAVE MANUAL DAILY LOGS FROM CALENDAR
  const handleSaveLogCalendar = async () => {
    setLogSubmitting(true);
    try {
      const payload = {
        log_date: selectedDayStr,
        flow_intensity: flow,
        mood: selectedMoods,
        pain_level: pain,
        energy_level: energy,
        notes: notes
      };

      if (isDemo) {
        const idx = MOCK_LOGS.findIndex(l => l.log_date === selectedDayStr);
        if (idx !== -1) {
          MOCK_LOGS[idx] = payload;
        } else {
          MOCK_LOGS.push(payload);
        }
        setSuccessToast(true);
        setTimeout(() => setSuccessToast(false), 3000);
        onRefresh();
      } else {
        await api.post('/api/logs', payload);
        setSuccessToast(true);
        setTimeout(() => setSuccessToast(false), 3000);
        onRefresh();
      }
      setSelectedDayLog(payload);
      setIsEditingLog(false);
    } catch (err) {
      triggerError("Gagal menyimpan log harian.");
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleMoodToggle = (moodId: string) => {
    if (selectedMoods.includes(moodId)) {
      setSelectedMoods(selectedMoods.filter(m => m !== moodId));
    } else {
      setSelectedMoods([...selectedMoods, moodId]);
    }
  };

  const togglePhaseFilter = (phase: string) => {
    if (activePhaseFilter === phase) {
      setActivePhaseFilter(null);
    } else {
      setActivePhaseFilter(phase);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Calendar Grid Container */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100">
        
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-rose-950">{monthName} {year}</h3>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Phase Filter panel (Interactive Glow Filters) */}
        <div className="mb-6 bg-rose-50/30 border border-rose-100/50 p-3 rounded-2xl">
          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-2 ml-1 text-center">
            💡 Pilih fase di bawah untuk menyalakan tanggalnya di kalender:
          </span>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <button 
              onClick={() => togglePhaseFilter('menstruation')}
              className={`py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${activePhaseFilter === 'menstruation' ? 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20 scale-105' : 'bg-rose-50/50 border-rose-100/60 text-rose-900/70 hover:bg-rose-100/40'}`}
            >
              🔴 Haid
            </button>
            <button 
              onClick={() => togglePhaseFilter('follicular')}
              className={`py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${activePhaseFilter === 'follicular' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-105' : 'bg-emerald-50/50 border-emerald-100/60 text-emerald-950/70 hover:bg-emerald-100/40'}`}
            >
              🌿 Folikuler
            </button>
            <button 
              onClick={() => togglePhaseFilter('ovulation')}
              className={`py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${activePhaseFilter === 'ovulation' ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20 scale-105' : 'bg-amber-50/50 border-amber-100/60 text-amber-950/70 hover:bg-amber-100/40'}`}
            >
              🌸 Subur
            </button>
            <button 
              onClick={() => togglePhaseFilter('luteal')}
              className={`py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${activePhaseFilter === 'luteal' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/20 scale-105' : 'bg-indigo-50/50 border-indigo-100/60 text-indigo-950/70 hover:bg-indigo-100/40'}`}
            >
              💜 Luteal
            </button>
          </div>
        </div>

        {/* Days of Week Name */}
        <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-rose-900/40">
          <span>Min</span>
          <span>Sen</span>
          <span>Sel</span>
          <span>Rab</span>
          <span>Kam</span>
          <span>Jum</span>
          <span>Sab</span>
        </div>

        {/* Calendar Cells Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm font-semibold">
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="py-2.5"></div>
          ))}

          {daysArray.map((dayNum) => {
            const details = getDayDetails(dayNum);
            const isSelected = selectedDayStr === details.dayStr;
            
            let cellStyle = 'hover:bg-rose-100/30 text-rose-900/80';
            
            if (details.isToday) {
              cellStyle = 'bg-white border-2 border-rose-500 glow-active text-rose-900';
            }

            if (details.isHistoryHaid) {
              cellStyle = 'bg-rose-200 border border-rose-300 text-rose-950 font-bold';
            } 
            else if (details.isHistoryOvulation) {
              cellStyle = 'bg-amber-100 border border-amber-200 text-amber-950 font-bold';
            }
            else if (details.isPredictedHaid) {
              cellStyle = 'border-2 border-dashed border-rose-400 bg-rose-50/40 text-rose-800 font-bold';
            }

            // Glow styling filter active
            let glowFilterStyle = '';
            if (activePhaseFilter) {
              if (details.phase === activePhaseFilter) {
                if (activePhaseFilter === 'menstruation') glowFilterStyle = 'ring-2 ring-rose-400 bg-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.5)] font-black scale-105 z-10';
                else if (activePhaseFilter === 'follicular') glowFilterStyle = 'ring-2 ring-emerald-400 bg-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.5)] font-black scale-105 z-10';
                else if (activePhaseFilter === 'ovulation') glowFilterStyle = 'ring-2 ring-amber-400 bg-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.5)] font-black scale-105 z-10';
                else if (activePhaseFilter === 'luteal') glowFilterStyle = 'ring-2 ring-indigo-400 bg-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.5)] font-black scale-105 z-10';
              } else {
                glowFilterStyle = 'opacity-30 scale-95';
              }
            }

            // Selection ring styling
            const selectRing = isSelected ? 'ring-2 ring-rose-600 scale-105 z-10 bg-rose-50/80' : '';

            return (
              <button
                key={dayNum}
                onClick={() => handleDaySelect(dayNum)}
                className={`py-2 rounded-xl transition-all relative flex flex-col items-center justify-center ${cellStyle} ${glowFilterStyle} ${selectRing}`}
                style={{ aspectRatio: '1' }}
              >
                <span>{dayNum}</span>
                {details.hasLog && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute bottom-1"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend Map */}
        <div className="mt-6 border-t border-rose-50 pt-4 flex flex-wrap gap-4 justify-center text-[10px] font-bold text-rose-900/60 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md bg-rose-200 border border-rose-300"></span>
            <span>Haid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md bg-amber-100 border border-amber-200"></span>
            <span>Masa Subur</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-md border-2 border-dashed border-rose-400 bg-rose-50/40"></span>
            <span>Perkiraan Haid</span>
          </div>
        </div>

      </div>

      {/* Selected Day Log Panel & Inline Editor */}
      {selectedDayLog ? (
        <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-4 animate-slide-up">
          
          <div className="flex justify-between items-center border-b border-rose-50 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Aktivitas Tanggal</span>
              <h4 className="text-sm font-bold text-rose-900">{selectedDayStr}</h4>
            </div>
            <span className="text-xs px-3 py-1 bg-rose-100/60 text-rose-700 font-semibold rounded-full capitalize">
              Fase: {selectedDayLog.empty ? selectedDayLog.phase : (prediction ? CycleCalculator.calculatePhaseForDate(selectedDayStr, cycles, prediction) : 'luteal')}
            </span>
          </div>

          {!isEditingLog ? (
            <div className="space-y-4">
              {selectedDayLog.empty ? (
                <div className="text-center py-4 text-rose-900/40 text-xs font-medium">
                  Belum ada catatan keluhan/gejala tubuh pada hari ini.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Flow & Symptoms grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-rose-50/50 p-2.5 rounded-2xl border border-rose-100/30">
                      <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-0.5">Darah Haid</span>
                      <span className="text-xs font-bold text-rose-900 capitalize">
                        {selectedDayLog.flow_intensity === 'none' && 'Nihil'}
                        {selectedDayLog.flow_intensity === 'spotting' && 'Flek'}
                        {selectedDayLog.flow_intensity === 'light' && 'Sedikit'}
                        {selectedDayLog.flow_intensity === 'medium' && 'Sedang'}
                        {selectedDayLog.flow_intensity === 'heavy' && 'Banyak'}
                        {!['none', 'spotting', 'light', 'medium', 'heavy'].includes(selectedDayLog.flow_intensity) && (selectedDayLog.flow_intensity || 'Nihil')}
                      </span>
                    </div>

                    <div className="bg-rose-50/50 p-2.5 rounded-2xl border border-rose-100/30">
                      <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-0.5">Tingkat Nyeri</span>
                      <span className="text-xs font-black text-rose-900">{selectedDayLog.pain_level || 1} / 5</span>
                    </div>

                    <div className="bg-rose-50/50 p-2.5 rounded-2xl border border-rose-100/30">
                      <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-0.5">Tingkat Energi</span>
                      <span className="text-xs font-black text-rose-900">{selectedDayLog.energy_level || 4} / 5</span>
                    </div>
                  </div>

                  {/* Mood list */}
                  {selectedDayLog.mood?.length > 0 && (
                    <div>
                      <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-1 ml-1">Suasana Hati</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDayLog.mood.map((m: string) => (
                          <span key={m} className="text-xs bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full font-bold capitalize">
                            {m === 'happy' && '😊 Happy'}
                            {m === 'calm' && '😌 Calm'}
                            {m === 'sad' && '😢 Sad'}
                            {m === 'anxious' && '😰 Anxious'}
                            {m === 'irritable' && '😤 Mad'}
                            {!['happy', 'calm', 'sad', 'anxious', 'irritable'].includes(m) && m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedDayLog.notes && (
                    <div>
                      <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-1 ml-1">Catatan Keluhan</span>
                      <div className="bg-rose-50/30 border border-rose-100/20 p-3 rounded-2xl text-xs text-rose-900 leading-relaxed font-medium">
                        "{selectedDayLog.notes}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons Panel */}
              <div className="pt-3 border-t border-rose-100/60 flex flex-col gap-2">
                <div className="flex gap-2">
                  {!activeCycle ? (
                    <button
                      onClick={handleStartPeriodCalendar}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      🔴 Mulai Haid di Sini
                    </button>
                  ) : (
                    <button
                      onClick={handleEndPeriodCalendar}
                      className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      ⚪ Selesai Haid di Sini
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditingLog(true)}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    📝 {selectedDayLog.empty ? "Catat Gejala" : "Edit Gejala"}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            // INLINE DAILY LOG EDITOR FORM
            <div className="space-y-4 animate-slide-down text-left">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50 ml-1">
                ✍️ Formulir Pencatatan Tanggal {selectedDayStr}
              </span>

              {/* Flow Selector */}
              <div>
                <label className="block text-[10px] font-bold text-rose-900/60 uppercase tracking-wider mb-1.5 ml-1">Volume Darah Haid</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['none', 'spotting', 'light', 'medium', 'heavy'] as const).map((intensity) => (
                    <button
                      key={intensity}
                      onClick={() => setFlow(intensity)}
                      className={`py-2 rounded-xl text-[10px] font-bold transition-all border ${flow === intensity ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-rose-50/50 border-rose-100/60 text-rose-900/70 hover:bg-rose-100/40'}`}
                    >
                      {intensity === 'none' && "Nihil"}
                      {intensity === 'spotting' && "Flek"}
                      {intensity === 'light' && "Sedikit"}
                      {intensity === 'medium' && "Sedang"}
                      {intensity === 'heavy' && "Banyak"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="text-[10px] font-bold text-rose-900/60 uppercase tracking-wider">Tingkat Nyeri</label>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded">{pain}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5"
                    value={pain}
                    onChange={(e) => setPain(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 ml-1">
                    <label className="text-[10px] font-bold text-rose-900/60 uppercase tracking-wider">Tingkat Energi</label>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded">{energy}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5"
                    value={energy}
                    onChange={(e) => setEnergy(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
              </div>

              {/* Mood multi-select */}
              <div>
                <label className="block text-[10px] font-bold text-rose-900/60 uppercase tracking-wider mb-1.5 ml-1">Suasana Hati</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'happy', label: '😊 Happy' },
                    { id: 'calm', label: '😌 Calm' },
                    { id: 'sad', label: '😢 Sad' },
                    { id: 'anxious', label: '😰 Anxious' },
                    { id: 'irritable', label: '😤 Mad' }
                  ].map((mood) => {
                    const active = selectedMoods.includes(mood.id);
                    return (
                      <button
                        key={mood.id}
                        onClick={() => handleMoodToggle(mood.id)}
                        className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all border ${active ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-rose-50/50 border-rose-100/60 text-rose-900/70 hover:bg-rose-100/40'}`}
                      >
                        {mood.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-rose-900/60 uppercase tracking-wider mb-1 ml-1">Catatan</label>
                <textarea
                  maxLength={500}
                  rows={2}
                  placeholder="Nyeri pinggang? Mood swing? Catat di sini..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-rose-900 resize-none border border-rose-100/50"
                ></textarea>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveLogCalendar}
                  disabled={logSubmitting}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-sm"
                >
                  {logSubmitting ? "Menyimpan..." : "✓ Simpan Catatan"}
                </button>
                <button
                  onClick={() => setIsEditingLog(false)}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
              </div>

              {successToast && (
                <p className="text-[9px] text-center text-teal-600 font-bold animate-pulse">
                  ✓ Catatan berhasil disimpan pada kalender!
                </p>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-6 text-rose-900/40 text-xs font-bold uppercase tracking-wider">
          💡 Tap salah satu tanggal di atas untuk melihat catatan detail.
        </div>
      )}

    </div>
  );
};

// =========================================================================
// 5. VIEW: INSIGHTS (Gemini AI Summary & Premium Custom Charts)
// =========================================================================
interface InsightsProps {
  cycles: any[];
  logs: any[];
  onEditDate?: (dateStr: string) => void;
}

const InsightsView: React.FC<InsightsProps> = ({ cycles, logs, onEditDate }) => {
  const [monthYear, setMonthYear] = useState<string>('2026-05');

  // Filter logs bulan aktif
  const activeMonthLogs = logs.filter(l => l.log_date.startsWith(monthYear));

  // Custom premium SVG Line Chart (Panjang Siklus Historis)
  // Menampilkan panjang siklus untuk siklus tertutup (maksimal 5 riwayat)
  const completedCycles = cycles.filter(c => c.cycle_length !== null).slice(-5);
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 30;

  return (
    <div className="space-y-6">
      
      {/* 1. Cycle Length Line Chart (Custom SVG - Super Premium & Cute) */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100">
        <div className="mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Visualisasi Siklus</span>
          <h4 className="text-sm font-bold text-rose-900 mt-0.5">Grafik Panjang Siklus Historis</h4>
        </div>

        {completedCycles.length === 0 ? (
          <div className="text-center py-10 text-rose-900/40 text-xs font-bold uppercase tracking-wider">
            📊 Belum memiliki riwayat siklus tertutup untuk dimuat.
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-sm">
              {/* Grid Lines */}
              <line x1={padding} y1={20} x2={chartWidth - padding} y2={20} stroke="#fecdd3" strokeDasharray="3" />
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#fecdd3" />
              
              {/* Draw Line Points */}
              {completedCycles.map((c, idx) => {
                const count = completedCycles.length;
                const x = padding + (idx * (chartWidth - padding * 2)) / Math.max(1, count - 1);
                // Kita petakan nilai 15-45 hari ke tinggi 20-90 px
                const lengthVal = c.cycle_length || 28;
                const minL = 15;
                const maxL = 45;
                const y = chartHeight - padding - ((lengthVal - minL) * (chartHeight - padding - 20)) / (maxL - minL);

                const nextC = completedCycles[idx + 1];
                let nextLine = null;
                if (nextC) {
                  const nextX = padding + ((idx + 1) * (chartWidth - padding * 2)) / Math.max(1, count - 1);
                  const nextLengthVal = nextC.cycle_length || 28;
                  const nextY = chartHeight - padding - ((nextLengthVal - minL) * (chartHeight - padding - 20)) / (maxL - minL);
                  nextLine = <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#f43f5e" strokeWidth="2.5" />;
                }

                return (
                  <g key={c.id}>
                    {nextLine}
                    <circle cx={x} cy={y} r="5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                    <text x={x} y={y - 8} fontSize="9" fontWeight="bold" fill="#be123c" textAnchor="middle">{lengthVal} hr</text>
                    <text x={x} y={chartHeight - 10} fontSize="8" fontWeight="bold" fill="#fda4af" textAnchor="middle">
                      {c.start_date.substring(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* 2. Symptom Heatmap (Cute Month Log Grid) */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Heatmap Gejala</span>
            <h4 className="text-sm font-bold text-rose-900 mt-0.5">Catatan Nyeri Bulanan</h4>
          </div>
          <select 
            value={monthYear} 
            onChange={(e) => setMonthYear(e.target.value)}
            className="text-xs bg-rose-50 border border-rose-100 rounded-xl px-2.5 py-1 text-rose-800 font-bold"
          >
            <option value="2026-05">Mei 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">Maret 2026</option>
          </select>
        </div>

        {activeMonthLogs.length === 0 ? (
          <div className="text-center py-10 text-rose-900/40 text-xs font-bold uppercase tracking-wider">
            📆 Belum mencatat log harian pada bulan ini.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {activeMonthLogs.map((log) => {
                const painVal = log.pain_level || 1;
                // Petakan warna tingkat nyeri
                let painColor = 'bg-rose-50 text-rose-400';
                if (painVal === 2) painColor = 'bg-rose-100 text-rose-600';
                if (painVal === 3) painColor = 'bg-rose-200 text-rose-700';
                if (painVal === 4) painColor = 'bg-rose-300 text-rose-800';
                if (painVal === 5) painColor = 'bg-rose-500 text-white font-bold';

                return (
                  <button 
                    key={log.log_date} 
                    onClick={() => onEditDate && onEditDate(log.log_date)}
                    className={`py-2 rounded-xl text-xs font-extrabold flex flex-col justify-center items-center ${painColor} hover:scale-105 transition-all cursor-pointer`}
                    style={{ aspectRatio: '1' }}
                    title={`Nyeri: ${painVal}. Klik untuk mengedit.`}
                  >
                    <span>{log.log_date ? parseInt(log.log_date.substring(0, 10).split('-')[2], 10) : ''}</span>
                    <span className="text-[7px] block uppercase font-bold leading-none mt-0.5">Lv {painVal}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[9px] font-bold text-rose-900/40 uppercase tracking-wider border-t border-rose-50 pt-3">
              <span>Nyaman (Lv 1)</span>
              <div className="flex gap-1">
                <span className="w-3.5 h-3.5 bg-rose-50 rounded-sm"></span>
                <span className="w-3.5 h-3.5 bg-rose-100 rounded-sm"></span>
                <span className="w-3.5 h-3.5 bg-rose-200 rounded-sm"></span>
                <span className="w-3.5 h-3.5 bg-rose-300 rounded-sm"></span>
                <span className="w-3.5 h-3.5 bg-rose-500 rounded-sm"></span>
              </div>
              <span>Sakit (Lv 5)</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Gemini AI Reflection Assistant (Wow Factor) */}
      {/* AI Summary Card has been removed as requested for stability */}

    </div>
  );
};

// =========================================================================
// 6. VIEW: DOCTOR EXPORT (Tailwind CSS Print Page)
// =========================================================================
interface ExportProps {
  profile: any;
  logs: any[];
}

const ExportView: React.FC<ExportProps> = ({ profile, logs }) => {
  const [monthYear, setMonthYear] = useState<string>('2026-05');

  // Ambil logs bulan aktif
  const activeMonthLogs = logs.filter(l => l.log_date.startsWith(monthYear));

  // Hitung statistik bulanan
  const haidDaysCount = activeMonthLogs.filter(l => l.flow_intensity && l.flow_intensity !== 'none').length;
  
  // Hitung rata-rata nyeri
  const avgPain = activeMonthLogs.length > 0
    ? (activeMonthLogs.reduce((sum, l) => sum + (l.pain_level || 1), 0) / activeMonthLogs.length).toFixed(1)
    : '0.0';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Setup Selection (No Print Area) */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-4 no-print">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Cetak Laporan</span>
          <h4 className="text-sm font-bold text-rose-900 mt-0.5">Siapkan Laporan Konsultasi Dokter</h4>
        </div>
        
        <p className="text-xs text-rose-900/60 leading-relaxed">
          Pilihlah periode bulan yang ingin Anda cetak. Halaman ini sudah didesain khusus agar saat tombol cetak ditekan, visual yang dihasilkan bersih, rapi, terorganisir, dan siap ditunjukkan ke dokter kandungan!
        </p>

        <div className="flex gap-3">
          <select 
            value={monthYear} 
            onChange={(e) => setMonthYear(e.target.value)}
            className="flex-1 text-xs bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5 text-rose-800 font-bold"
          >
            <option value="2026-05">Mei 2026</option>
            <option value="2026-04">April 2026</option>
          </select>

          <button
            onClick={handlePrint}
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* 2. PRINT PREVIEW PAGE (Didesain seindah mungkin untuk cetakan) */}
      <div className="glass-card rounded-3xl p-8 border border-slate-200 bg-white text-slate-800 shadow-md space-y-6 font-sans">
        
        {/* Header Laporan Cetak */}
        <div className="flex justify-between items-start border-b-2 border-rose-500 pb-4">
          <div>
            <h2 className="text-2xl font-black text-rose-900 leading-tight">MOODARA REPORT</h2>
            <p className="text-xs text-slate-500 font-semibold tracking-wide mt-0.5">MENSTRUAL WELLNESS CONSULTATION REPORT</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-rose-800 bg-rose-100/50 px-3 py-1 rounded-full uppercase tracking-wider">{monthYear}</span>
          </div>
        </div>

        {/* Profil Medis Pasien */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Nama Pasien</span>
            <span className="text-sm font-bold text-slate-800">{profile?.name || "Lia"}</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Usia Pasien</span>
            <span className="text-sm font-bold text-slate-800">
              {profile?.birth_date ? `${new Date().getFullYear() - new Date(profile.birth_date).getFullYear()} Tahun` : "23 Tahun"}
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Tinggi & Berat</span>
            <span className="text-sm font-bold text-slate-800">
              {profile?.height ? Math.round(parseFloat(profile.height)) : 160} cm / {profile?.weight ? Math.round(parseFloat(profile.weight)) : 52} kg
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Default Siklus</span>
            <span className="text-sm font-bold text-slate-800">{profile?.avg_cycle_length || 28} Hari</span>
          </div>
        </div>

        {/* Statistik Ringkas Medis */}
        <div className="grid grid-cols-3 gap-3 border-t border-b border-slate-100 py-3 text-center">
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Hari Pendarahan</span>
            <span className="text-lg font-black text-rose-700">{haidDaysCount} Hari</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Rata-rata Nyeri</span>
            <span className="text-lg font-black text-rose-700">{avgPain} / 5</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Hari Terlog</span>
            <span className="text-lg font-black text-rose-700">{activeMonthLogs.length} Hari</span>
          </div>
        </div>

        {/* Tabel Rekaman Gejala Detil */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider ml-1">Timeline Gejala Harian</h4>
          
          {activeMonthLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic">
              Tidak ada riwayat log harian untuk periode ini.
            </div>
          ) : (
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="bg-rose-50/50 text-rose-900 font-extrabold border-b border-rose-100">
                  <th className="py-2 px-2.5">Tanggal</th>
                  <th className="py-2 px-2.5">Volume Haid</th>
                  <th className="py-2 px-2.5">Nyeri</th>
                  <th className="py-2 px-2.5">Energi</th>
                  <th className="py-2 px-2.5">Suasana Hati</th>
                  <th className="py-2 px-2.5">Catatan Keluhan / Gejala</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMonthLogs.map((log) => (
                  <tr key={log.log_date} className="hover:bg-slate-50/30">
                    <td className="py-2 px-2.5 font-bold">{log.log_date ? parseInt(log.log_date.substring(0, 10).split('-')[2], 10) : '-'}</td>
                    <td className="py-2 px-2.5 font-semibold capitalize">{log.flow_intensity || 'none'}</td>
                    <td className="py-2 px-2.5 font-black">{log.pain_level || 1}</td>
                    <td className="py-2 px-2.5 font-black">{log.energy_level || 4}</td>
                    <td className="py-2 px-2.5 font-bold">{log.mood?.join(', ') || 'calm'}</td>
                    <td className="py-2 px-2.5 max-w-[150px] truncate text-slate-500" title={log.notes}>
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Disclaimer Medis Standar */}
        <div className="border-t border-rose-200/50 pt-4 text-[9px] text-slate-400 leading-relaxed">
          <p className="font-bold text-rose-800">Catatan untuk Tenaga Medis:</p>
          <p className="mt-0.5">
            Laporan ini dibuat secara otomatis oleh aplikasi **Moodara** berdasarkan data kesehatan harian yang diisi secara sukarela oleh pasien. Ringkasan serta pola tidak merepresentasikan diagnosis formal medis. Gunakan data terstruktur ini sebagai penunjang anamnesis klinis.
          </p>
        </div>

      </div>

    </div>
  );
};

// =========================================================================
// 7. VIEW: ACCOUNT VIEW (Physical stats editor & credentials info)
// =========================================================================
interface AccountProps {
  profile: any;
  isDemo: boolean;
  onRefresh: () => void;
  triggerError: (msg: string) => void;
}

const AccountView: React.FC<AccountProps> = ({ profile, isDemo, onRefresh, triggerError }) => {
  const [weight, setWeight] = useState<number>(profile?.weight || 50);
  const [height, setHeight] = useState<number>(profile?.height || 160);
  const [updating, setUpdating] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (profile) {
      setWeight(profile.weight || 50);
      setHeight(profile.height || 160);
    }
  }, [profile]);

  const handleSave = async () => {
    setUpdating(true);
    setSuccess(false);
    try {
      const payload = {
        name: profile?.name || 'Rara',
        birth_date: profile?.birth_date || '2003-08-15',
        last_period_date: profile?.last_period_date || '2026-05-10',
        avg_cycle_length: profile?.avg_cycle_length || 28,
        weight: weight,
        height: height
      };

      if (isDemo) {
        MOCK_PROFILE.weight = weight;
        MOCK_PROFILE.height = height;
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        onRefresh();
      } else {
        await api.post('/api/users/onboard', payload);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        onRefresh();
      }
    } catch (err: any) {
      triggerError("Gagal memperbarui data fisik Anda.");
    } finally {
      setUpdating(false);
    }
  };

  const age = profile?.birth_date 
    ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() 
    : 23;

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      {/* Profile Card Summary */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 text-center relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-rose-100/50 rounded-full blur-xl"></div>
        <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-yellow-50/50 rounded-full blur-xl"></div>
        
        <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black border-4 border-rose-50 shadow-md">
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'L'}
        </div>
        
        <h3 className="text-lg font-bold text-rose-950">{profile?.name || 'Pengguna Moodara'}</h3>
        <p className="text-xs text-rose-600/70">{age} tahun</p>
      </div>

      {/* Physical Stats Editor Card */}
      <div className="glass-card rounded-3xl p-6 border border-rose-100 space-y-6">
        <div className="border-b border-rose-50 pb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900/50">Detail Fisik & Akun</span>
          <h4 className="text-sm font-bold text-rose-900">Sesuaikan Data Tubuh Anda</h4>
        </div>

        {/* Weight Selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold text-rose-900/80">Berat Badan (BB)</label>
            <span className="text-sm font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100/50">{Math.round(weight)} kg</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setWeight(Math.max(30, weight - 1))}
              className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100/50 flex items-center justify-center font-bold text-rose-700 transition-colors text-lg"
            >
              -
            </button>
            <input 
              type="number" 
              min="30" 
              max="150"
              value={Math.round(weight)}
              onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
              className="flex-1 px-4 py-2 text-center rounded-xl bg-white border border-rose-200/60 text-sm font-bold text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            <button 
              onClick={() => setWeight(Math.min(150, weight + 1))}
              className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100/50 flex items-center justify-center font-bold text-rose-700 transition-colors text-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* Height Selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold text-rose-900/80">Tinggi Badan (TB)</label>
            <span className="text-sm font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100/50">{Math.round(height)} cm</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setHeight(Math.max(100, height - 1))}
              className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100/50 flex items-center justify-center font-bold text-rose-700 transition-colors text-lg"
            >
              -
            </button>
            <input 
              type="number" 
              min="100" 
              max="220"
              value={Math.round(height)}
              onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
              className="flex-1 px-4 py-2 text-center rounded-xl bg-white border border-rose-200/60 text-sm font-bold text-rose-950 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            <button 
              onClick={() => setHeight(Math.min(220, height + 1))}
              className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100/50 flex items-center justify-center font-bold text-rose-700 transition-colors text-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* Informational Read-Only Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-rose-50/60 text-center">
          <div className="bg-rose-50/30 p-3 rounded-2xl border border-rose-100/30">
            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-0.5">Siklus Bawaan</span>
            <span className="text-xs font-bold text-rose-900">{profile?.avg_cycle_length || 28} Hari</span>
          </div>
          <div className="bg-rose-50/30 p-3 rounded-2xl border border-rose-100/30">
            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-rose-900/50 mb-0.5">Haid Terakhir</span>
            <span className="text-xs font-bold text-rose-900">
              {profile?.last_period_date ? (() => {
                const d = new Date(profile.last_period_date);
                if (isNaN(d.getTime())) return profile.last_period_date;
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                return `${d.getDate()} ${months[d.getMonth()]}`;
              })() : '-'}
            </span>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={updating}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {updating ? "Menyimpan..." : "✓ Simpan Perubahan Tubuh"}
          </button>
          {success && (
            <p className="text-[10px] text-center text-teal-600 font-bold mt-2 animate-pulse">
              ✓ Data tubuh berhasil diperbarui!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
