
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  Zap, ArrowRight, User as UserIcon, BookOpen,
  Loader2, Sparkles, CheckCircle2, Brain, Shield, Target, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeBranchRoadmap } from '../services/geminiService';
import { auth, db } from '../services/firebase';
import { ENGINEERING_SYLLABUS } from '../data/syllabus';

export const Auth: React.FC = () => {
  const { setUser, setSubjectsAndTopics } = useApp();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const [formData, setFormData] = useState({
    name: '',
    branch: '',
    year: '1'
  });

  const branches = ENGINEERING_SYLLABUS.map(b => b.branch);

  // Check database connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (db && auth) {
          setDbStatus('connected');
        } else {
          setDbStatus('disconnected');
        }
      } catch (error) {
        setDbStatus('disconnected');
      }
    };

    checkConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.branch) return;

    setIsInitializing(true);

    try {
      // Create a local user identity
      const userId = 'user-' + Date.now();

      // Auto-generate a dummy email for type compatibility
      const dummyEmail = `${formData.name.toLowerCase().replace(/\s+/g, '.')}@student.axent`;

      // Generate roadmap using Tambo AI based on selected branch
      const roadmap = await initializeBranchRoadmap(userId, formData.branch);

      if (roadmap.subjects.length > 0) {
        setSubjectsAndTopics(roadmap.subjects, roadmap.topics);
      }

      setUser({
        id: userId,
        name: formData.name,
        email: dummyEmail,
        branch: formData.branch,
        year: parseInt(formData.year),
        energyPreference: 'morning', // Default
        dailyStudyHours: 4 // Default
      });

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setIsInitializing(false);
      alert("Setup failed. Please check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-white dark:bg-[#0a0a0a] overflow-hidden transition-colors">
      <AnimatePresence>
        {isInitializing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-indigo-600 dark:bg-indigo-700 flex flex-col items-center justify-center text-white px-10 text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="mb-8 text-white/40"
            >
              <Sparkles size={64} />
            </motion.div>
            <h2 className="text-4xl font-black mb-4 tracking-tight">Personalizing your experience...</h2>
            <p className="text-indigo-100 text-lg max-w-md font-medium opacity-80 mb-10 italic">
              "Building a custom roadmap for {formData.branch}..."
            </p>
            <div className="w-64 h-2 bg-indigo-500 rounded-full overflow-hidden shadow-inner relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 8 }}
                className="h-full bg-white shadow-[0_0_15px_white]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-10 md:px-20 lg:px-32 py-16 bg-slate-50 dark:bg-slate-900 transition-colors">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
              <Zap size={28} fill="currentColor" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Axent<span className="text-indigo-600 dark:text-indigo-400">AI</span>
            </span>
          </div>

          <div className="flex flex-col gap-1 mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold w-fit ${dbStatus === 'connected' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
              dbStatus === 'disconnected' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
              }`}>
              {dbStatus === 'connected' && <CheckCircle2 size={14} />}
              {dbStatus === 'disconnected' && <CheckCircle2 size={14} />}
              {/* Using CheckCircle regardless of connection to reduce friction since auth is simplified */}
              {dbStatus === 'checking' && <Loader2 size={14} className="animate-spin" />}
              {dbStatus === 'connected' ? 'System Online' : 'Local Mode Ready'}
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Start Your Journey
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Enter your details to generate your personalized engineering roadmap.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-6 max-w-md"
        >
          <div>
            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-14 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base font-semibold focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder="Enter your name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Branch
              </label>
              <div className="relative">
                <BookOpen className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full pl-14 pr-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base font-semibold focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition-all text-slate-900 dark:text-white appearance-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Select Branch</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Year
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base font-semibold focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition-all text-slate-900 dark:text-white appearance-none cursor-pointer"
                  required
                >
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                  <option value="3">3rd</option>
                  <option value="4">4th</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isInitializing}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-base font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50 group"
          >
            {isInitializing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Enter Dashboard
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </motion.form>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-wrap gap-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
            No Sign Up Required
          </div>
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-indigo-500 dark:text-indigo-400" />
            AI-Powered
          </div>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-500 dark:text-violet-400" />
            Local & Privacy First
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Hero Section */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="hidden lg:flex flex-1 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 flex-col justify-center items-center text-white px-16 relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative z-10 max-w-lg text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="mb-10 inline-block"
          >
            <div className="w-32 h-32 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl border border-white/20">
              <Target size={64} className="text-white" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-5xl font-black tracking-tight leading-tight mb-6"
          >
            Your AI Study Companion
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-xl text-indigo-100 font-medium leading-relaxed mb-12"
          >
            Skip the setup. Jump straight into personalized learning paths and intelligent scheduling tailored for your branch.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-3 gap-8"
          >
            {[
              { icon: Brain, label: "Smart AI", desc: "Adaptive Learning" },
              { icon: Target, label: "Goal Tracking", desc: "Progress Insights" },
              { icon: Sparkles, label: "Personalized", desc: "Tailored Plans" }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
                  <item.icon size={28} />
                </div>
                <p className="font-black text-sm mb-1">{item.label}</p>
                <p className="text-xs text-indigo-200 font-medium">{item.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
