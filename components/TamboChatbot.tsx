import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2, Zap, Settings as SettingsIcon, BrainCircuit, Sparkles } from 'lucide-react';
import { TamboProvider, useTamboThread, useTamboThreadInput, defineTool } from '@tambo-ai/react';
import { useApp } from '../store/AppContext';
import { z } from 'zod';
import type { Subject, Topic, User, AdaptivePlan } from '../types';
import { ENGINEERING_SYLLABUS, getSubjectsForBranchYear } from '../data/syllabus';
import {
  generateSubjectRoadmap,
  getTopicDetails,
  initializeBranchRoadmap,
  generateAdaptiveStudyPlan
} from '../services/geminiService';

const TAMBO_API_KEY = import.meta.env.VITE_TAMBO_API_KEY ?? '';

function createTamboTools(
  user: User | null,
  subjects: Subject[],
  topics: Topic[],
  addSubject: (s: Subject) => void,
  addTopic: (t: Topic) => void,

  setSubjectsAndTopics: (s: Subject[], t: Topic[]) => void
) {
  return [
    defineTool({
      name: 'plan_subject',
      description:
        'Generate a learning roadmap for an engineering subject. Use when the user asks to plan, create roadmap, or help learn a subject (e.g. Data Structures, Heat Transfer, Fluid Mechanics).',
      tool: async ({ subjectName }: { subjectName: string }) => {
        const { subject, topics: newTopics } = await generateSubjectRoadmap(
          subjectName,
          user?.id || 'user-1',
          user?.branch
        );
        if (subject && newTopics.length > 0) {
          addSubject(subject);
          newTopics.forEach((t) => addTopic(t));
          return {
            success: true,
            subjectTitle: subject.title,
            topicCount: newTopics.length,
            topics: newTopics.map((t) => t.title),
            message: `Created roadmap for ${subject.title} with ${newTopics.length} topics. Check your Roadmap and Planner pages.`,
          };
        }
        return { success: false, message: 'Could not generate roadmap. Ensure VITE_GEMINI_API_KEY is set.' };
      },
      inputSchema: z.object({
        subjectName: z.string().describe('The engineering subject name to create a roadmap for'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        subjectTitle: z.string().optional(),
        topicCount: z.number().optional(),
        topics: z.array(z.string()).optional(),
        message: z.string(),
      }),
    }),

    defineTool({
      name: 'generate_study_schedule',
      description: 'Generate a personalized adaptive study plan. Use when the user asks to "make a schedule", "plan my week", or "how should I study?".',
      tool: async () => {
        if (!user || subjects.length === 0) {
          return { success: false, message: 'Please add subjects to your profile before generating a schedule.' };
        }
        const { plan, error } = await generateAdaptiveStudyPlan(user, subjects, topics);

        if (plan && plan.visualSchedule) {
          // Format the schedule with clear spacing and bullet points
          let scheduleText = "Here is your personalized weekly schedule:\n";

          plan.visualSchedule.forEach(day => {
            scheduleText += `\n### ${day.day}\n`;
            day.tasks.forEach(task => {
              scheduleText += `• ${task}\n`;
            });
          });

          if (plan.summary) {
            scheduleText += `\n---\n\n### Summary\n`;
            scheduleText += `• Goal: ${plan.summary.completionTimeline}\n`;
            scheduleText += `• Focus: ${plan.summary.confidenceImprovement}`;
          }

          return {
            success: true,
            summary: plan.summary,
            visualSchedule: plan.visualSchedule,
            message: scheduleText
          };
        }
        return { success: false, message: `I couldn't generate the plan right now. ${error || 'Please try again.'}` };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        summary: z.object({
          completionTimeline: z.string(),
          confidenceImprovement: z.string(),
          workloadRiskReduction: z.string()
        }).optional(),
        visualSchedule: z.array(z.object({
          day: z.string(),
          tasks: z.array(z.string())
        })).optional(),
        message: z.string()
      })
    }),



    defineTool({
      name: 'get_topic_details',
      description:
        'Get detailed study guidance for a specific topic in a subject. Use when the user asks about a topic, wants to understand a concept, or needs study tips for a unit.',
      tool: async ({ topicTitle, subjectTitle }: { topicTitle: string; subjectTitle: string }) => {
        const details = await getTopicDetails(topicTitle, subjectTitle);
        return { success: true, details, topicTitle, subjectTitle };
      },
      inputSchema: z.object({
        topicTitle: z.string().describe('The topic/unit name'),
        subjectTitle: z.string().describe('The subject this topic belongs to'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        details: z.string(),
        topicTitle: z.string(),
        subjectTitle: z.string(),
      }),
    }),

    defineTool({
      name: 'list_my_subjects',
      description:
        'List the user\'s current subjects and their topics. Use when the user asks what subjects they have, what they\'re studying, or their current roadmap.',
      tool: async () => {
        const summary = subjects.map((s) => ({
          title: s.title,
          topics: topics.filter((t) => t.subjectId === s.id).map((t) => t.title),
          topicCount: topics.filter((t) => t.subjectId === s.id).length,
        }));
        return { success: true, subjects: summary };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        subjects: z.array(z.object({
          title: z.string(),
          topics: z.array(z.string()),
          topicCount: z.number(),
        })),
      }),
    }),

    defineTool({
      name: 'initialize_branch_roadmap',
      description:
        'Create a full branch roadmap with subjects and topics for the user\'s engineering branch. Use when the user wants to start fresh, set up their curriculum, or get a complete roadmap for their branch.',
      tool: async () => {
        if (!user) return { success: false, message: 'User not set.' };
        const roadmap = await initializeBranchRoadmap(user.id, user.branch);
        if (roadmap.subjects.length > 0) {
          setSubjectsAndTopics(roadmap.subjects, roadmap.topics);
          return {
            success: true,
            subjectCount: roadmap.subjects.length,
            topicCount: roadmap.topics.length,
            message: `Created ${roadmap.subjects.length} subjects with ${roadmap.topics.length} topics for ${user.branch}. Check Roadmap and Planner.`,
          };
        }
        return { success: false, message: 'Could not generate branch roadmap.' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({
        success: z.boolean(),
        subjectCount: z.number().optional(),
        topicCount: z.number().optional(),
        message: z.string(),
      }),
    }),

    defineTool({
      name: 'list_syllabus_subjects',
      description:
        'List available subjects from the engineering syllabus for a given branch and year. Use when the user asks what subjects are in their branch/year or wants to add a subject from the curriculum.',
      tool: async ({ branch, year }: { branch: string; year: number }) => {
        const subjectsList = getSubjectsForBranchYear(branch, year);
        const branches = ENGINEERING_SYLLABUS.map((b) => b.branch);
        return {
          success: true,
          branch,
          year,
          subjects: subjectsList,
          availableBranches: branches,
        };
      },
      inputSchema: z.object({
        branch: z.string().describe('Engineering branch (e.g. Mechanical Engineering, Computer Science Engineering)'),
        year: z.number().min(1).max(4).describe('Academic year (1-4)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        branch: z.string(),
        year: z.number(),
        subjects: z.array(z.string()),
        availableBranches: z.array(z.string()),
      }),
    }),
  ];
}

function TamboChatbotUI() {
  const { user, subjects, topics, addSubject, addTopic, pendingChatMessage, sendToChat } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { thread, sendThreadMessage, generationStage } = useTamboThread();
  const { value, setValue, submit, isPending } = useTamboThreadInput();

  const isLoading = isPending || (generationStage && generationStage !== 'IDLE' && generationStage !== 'COMPLETE' && generationStage !== 'ERROR');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages, isLoading]);

  useEffect(() => {
    if (pendingChatMessage) {
      setIsOpen(true);
      setShowSettings(false);
      sendThreadMessage?.(pendingChatMessage, { streamResponse: true });
      sendToChat?.(null);
    }
  }, [pendingChatMessage]);

  const handleSend = () => {
    if (!value?.trim() || isLoading) return;
    submit?.({ streamResponse: true });
  };

  const messages = thread?.messages ?? [];
  const hasMessages = messages.length > 0;

  return (
    <div className="fixed bottom-8 right-8 z-[100] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[420px] h-[650px] bg-white rounded-[32px] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.25)] border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <BrainCircuit size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest">Tambo Intelligence</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Powered by Tambo Intelligence
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                >
                  <SettingsIcon size={18} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 text-slate-400 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
                {!hasMessages && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] p-4 rounded-2xl rounded-tl-none bg-white border border-slate-200 shadow-sm text-slate-700 text-sm leading-relaxed space-y-2">
                      <p><strong>Hi {user?.name?.split(' ')[0] || 'there'}!</strong> I&apos;m your Tambo Intelligence assistant for Axent. I can:</p>
                      <ul className="list-disc list-inside text-xs space-y-1 text-slate-600">
                        <li><strong>Plan subjects</strong> – &quot;Plan my subject Data Structures&quot;</li>

                        <li><strong>Get topic details</strong> – &quot;Explain Heat Transfer basics&quot;</li>
                        <li><strong>List syllabus</strong> – &quot;What subjects are in Year 2 Mechanical?&quot;</li>
                        <li><strong>Initialize roadmap</strong> – &quot;Set up my branch roadmap&quot;</li>
                        <li><strong>Answer questions</strong> – Any {user?.branch} study help</li>
                      </ul>
                    </div>
                  </div>
                )}
                {messages.map((msg: { id?: string; role: string; content?: unknown }) => (
                  <div
                    key={msg.id || Math.random()}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-md rounded-tr-none'
                        : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-none'
                        }`}
                    >
                      {Array.isArray(msg.content)
                        ? msg.content.map((part: { type?: string; text?: string }, i: number) =>
                          part.type === 'text' ? (
                            <span key={i}>{part.text}</span>
                          ) : null
                        )
                        : typeof msg.content === 'string'
                          ? msg.content
                          : JSON.stringify(msg.content)}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm">
                      <Loader2 size={16} className="animate-spin text-indigo-600" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white border-t border-slate-100">
                <div className="relative group">
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => setValue?.(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Plan subjects, schedule week, explain topics..."
                    className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:outline-none focus:border-indigo-600 font-bold text-sm transition-all shadow-inner"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!value?.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Plan • Schedule • Explain • Syllabus
                  </span>
                  <div className="flex items-center gap-1">
                    <Sparkles size={10} className="text-indigo-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tambo Intelligence</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-slate-900 text-white rounded-[24px] flex items-center justify-center shadow-2xl relative group"
      >
        <div className="absolute inset-0 bg-indigo-600 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl"></div>
        {isOpen ? <X size={28} /> : <Zap size={28} fill="white" />}
      </motion.button>
    </div>
  );
}

export const TamboChatbot: React.FC = () => {
  const {
    user,
    subjects,
    topics,
    addSubject,
    addTopic,
    setSubjectsAndTopics,
  } = useApp();

  const tools = React.useMemo(
    () =>
      createTamboTools(
        user,
        subjects,
        topics,
        addSubject as (s: Subject) => void,
        addTopic as (t: Topic) => void,
        setSubjectsAndTopics
      ),
    [user, subjects, topics, addSubject, addTopic, setSubjectsAndTopics]
  );

  if (!TAMBO_API_KEY || TAMBO_API_KEY.trim() === '') {
    return (
      <div className="fixed bottom-8 right-8 z-[100]">
        <a
          href="https://tambo.co/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-16 h-16 bg-slate-900 text-white rounded-[24px] flex items-center justify-center shadow-2xl hover:bg-indigo-600 transition-colors"
          title="Add VITE_TAMBO_API_KEY to .env.local - Get key at tambo.co"
        >
          <Zap size={28} fill="white" />
        </a>
      </div>
    );
  }

  const contextHelpers = {
    userContext: () => ({
      key: 'userContext',
      value: `Student: ${user?.name}. Branch: ${user?.branch}. Daily study hours: ${user?.dailyStudyHours}h. Energy: ${user?.energyPreference}.`,
    }),
    subjectsContext: () => ({
      key: 'subjectsContext',
      value: `Active subjects: ${subjects.map((s) => s.title).join(', ') || 'none'}. Topics: ${topics.map((t) => t.title).join(', ') || 'none'}. In progress: ${topics.filter((t) => t.status === 'InProgress').map((t) => t.title).join(', ') || 'none'}.`,
    }),

    capabilitiesContext: () => ({
      key: 'capabilitiesContext',
      value: 'You have tools: plan_subject, generate_study_schedule, get_topic_details, list_my_subjects, initialize_branch_roadmap, list_syllabus_subjects. Use them when relevant.',
    }),
  };

  return (
    <TamboProvider
      apiKey={TAMBO_API_KEY}
      tools={tools}
      contextHelpers={contextHelpers}
    >
      <TamboChatbotUI />
    </TamboProvider>
  );
};
