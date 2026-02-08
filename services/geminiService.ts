
import { TamboAI } from "@tambo-ai/typescript-sdk";
import { User, Subject, Topic, AdaptivePlan } from "../types";

const parseStreamResponse = async (stream: any): Promise<string> => {
  let fullText = "";
  for await (const event of stream) {
    // console.log("Stream Event:", JSON.stringify(event)); // Debugging

    // Check for standard text delta (common in these streams)
    if (event.type === 'text_delta' && event.text) {
      fullText += event.text;
    }
    // Check for another common pattern
    else if (event.data?.text) {
      fullText += event.data.text;
    }
    // Check for message delta
    else if (event.delta?.text) {
      fullText += event.delta.text;
    }
    // Check for content block
    else if (event.type === 'text_content_block' && event.content?.text) {
      fullText += event.content.text;
    }
    // Check for direct text property
    else if (typeof event.text === 'string') {
      fullText += event.text;
    }
    // Fallback for content arrays
    else if (event.content && Array.isArray(event.content)) {
      event.content.forEach((c: any) => {
        if (c.type === 'text' && c.text) fullText += c.text;
        else if (c.text) fullText += c.text;
      });
    }
  }
  return fullText;
};

// Helper to clean JSON markdown blocks
const cleanJson = (text: string): string => {
  return text.replace(/```json\n?|\n?```/g, "").trim();
};

export const generateAdaptiveStudyPlan = async (
  user: User,
  subjects: Subject[],
  topics: Topic[]
): Promise<{ plan: AdaptivePlan | null; error?: string }> => {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY ?? '';
  if (!apiKey) return { plan: null, error: "Tambo API Key Missing" };

  const client = new TamboAI({ apiKey });

  const subjectsData = subjects.map(s => {
    const sTopics = topics.filter(t => t.subjectId === s.id);
    const weakTopics = sTopics.filter(t => t.weaknessScore > 6 || t.status === 'Todo').map(t => t.title);
    return {
      name: s.title,
      credits: s.credits || 3,
      confidence: s.confidenceLevel || 3,
      weakTopics: weakTopics,
      priority: s.priority,
      examDate: s.examDate
    };
  });

  const prompt = `
    SYSTEM ROLE
    You are an AI-powered adaptive study planning engine designed specifically for engineering students.
    Your job is to analyze academic inputs, cognitive load, deadlines, and personal constraints to generate a personalized, evolving study schedule.

    INPUTS:
    1. Student Profile:
       Name: ${user.name}
       Branch: ${user.branch}
       Daily Study Hours (Weekday): ${user.dailyStudyHours}
       Weekend Study Hours: ${user.studyHoursWeekend || user.dailyStudyHours + 2}
       Preferred Study Time: ${user.energyPreference === 'morning' ? 'Morning' : 'Night'}
    
    2. Subjects:
       ${JSON.stringify(subjectsData, null, 2)}

    CORE PLANNING OBJECTIVES:
    - Allocate time proportionally based on (Credits * Weight) + ((5 - Confidence) * Weight) + Weak Topic Count.
    - Schedule weak & prerequisite-heavy topics earlier (High Cognitive Load).
    - High-load tasks MUST be during ${user.energyPreference === 'morning' ? 'Morning' : 'Night'}.
    - No more than 2 consecutive high-load sessions.
    - Include Revision, Practice, and Buffer slots.

    OUTPUT STRUCTURE (JSON Format):
    {
      "visualSchedule": [
        { "day": "Monday", "tasks": ["Subject: Task (Type) [Load]"] }
      ],
      "subjectBreakdown": [
        { "subject": "Name", "hours": 10, "percentage": 25, "reasoning": "..." }
      ],
      "actionableSteps": ["Step 1", "Step 2"],
      "progressLogic": "Explanation of checkpoints...",
      "summary": {
        "completionTimeline": "...",
        "confidenceImprovement": "...",
        "workloadRiskReduction": "..."
      }
    }
    
    RETURN ONLY JSON. NO MARKDOWN.
  `;

  try {
    const stream = await client.threads.runs.create({
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      },
      userKey: 'user-1',
      thread: {
        userKey: 'user-1'
      }
    });

    const responseText = await parseStreamResponse(stream);
    console.log("Raw Tambo Response:", responseText);

    if (!responseText) throw new Error("Empty response from AI");

    return { plan: JSON.parse(cleanJson(responseText)) };
  } catch (e: any) {
    console.error("Adaptive Plan Generation Failed:", e);
    return { plan: null, error: e.message || "Unknown Error" };
  }
};

export const initializeBranchRoadmap = async (userId: string, branch: string): Promise<{ subjects: Subject[], topics: Topic[] }> => {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY ?? '';
  if (!apiKey) return { subjects: [], topics: [] };

  const client = new TamboAI({ apiKey });

  const branchContext: Record<string, string> = {
    "Computer Science & Engineering": "DSA, OS, DBMS, Computer Networks, Discrete Math, System Design, Web Technologies.",
    "Electronics & Communication": "Analog Circuits, Digital Electronics, Signals & Systems, Control Systems, Microprocessors, Communication Theory.",
    "Mechanical Engineering": "Thermodynamics, Fluid Mechanics, Strength of Materials, Theory of Machines, Manufacturing, Heat Transfer.",
    "Electrical & Electronics Engineering": "Power Systems, Electrical Machines, Network Theory, Control Systems, Power Electronics.",
    "Civil Engineering": "Structural Analysis, Geotechnical Engg, Fluid Mechanics, Surveying, Transportation, RCC Design.",
    "Data Science & AI": "Linear Algebra, Probability/Stats, Machine Learning, Deep Learning, SQL, Big Data, Python for Data Science."
  };

  const selectedContext = branchContext[branch] || "Advanced Mathematics, core engineering fundamentals, and project management.";

  const prompt = `
    You are an Academic Dean for ${branch}. 
    Create a high-performance 12-week study roadmap.
    Required Curriculum Areas: ${selectedContext}
    
    Format Guidelines:
    1. Create 5-6 core Subjects.
    2. For each subject, create 4-6 specific Units (Topics).
    3. Ensure difficulty levels are balanced (Beginner to Advanced).
    4. Provide logical dependencies (e.g., learn "Basics" before "Advanced").
    
    RETURN JSON ONLY:
    {
      "subjects": [{ "id": "...", "title": "...", "difficulty": "...", "priority": 1..5, "color": "..." }],
      "topics": [{ "id": "...", "subjectId": "...", "title": "...", "estimatedHours": 1..10, "status": "Todo" }]
    }
  `;

  try {
    const stream = await client.threads.runs.create({
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      },
      userKey: 'user-1',
      thread: {
        userKey: 'user-1'
      }
    });

    const responseText = await parseStreamResponse(stream);
    const data = JSON.parse(cleanJson(responseText));
    const now = new Date();

    data.subjects = (data.subjects || []).map((s: any, idx: number) => {
      const examDate = new Date();
      examDate.setMonth(now.getMonth() + 3 + idx);
      return {
        ...s,
        userId,
        examDate: s.examDate || examDate.toISOString().split('T')[0]
      };
    });

    return data;
  } catch (e) {
    console.error("AI Roadmap Generation Failed:", e);
    return { subjects: [], topics: [] };
  }
};

export const generateSubjectRoadmap = async (
  subjectTitle: string,
  userId: string = 'user-1',
  branch?: string
): Promise<{ subject: Subject; topics: Topic[] }> => {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY ?? '';
  if (!apiKey) return { subject: null as unknown as Subject, topics: [] };

  const client = new TamboAI({ apiKey });

  const prompt = `You are an academic expert. Create a complete learning roadmap for the engineering subject "${subjectTitle}"${branch ? ` (Branch: ${branch})` : ''}.

Generate 5-8 specific, actionable topics/units that a student should master to learn this subject effectively. Order them logically (foundations first, advanced last).
Each topic should be a concrete unit like "Introduction and Basics", "Core Concepts", "Problem Solving", etc.

Return JSON ONLY: { "topics": [ { "title": "Topic Name", "estimatedHours": 3, "weightage": 7, "weaknessScore": 5 } ] }`;

  try {
    const stream = await client.threads.runs.create({
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      },
      userKey: 'user-1',
      thread: {
        userKey: 'user-1'
      }
    });

    const responseText = await parseStreamResponse(stream);
    const data = JSON.parse(cleanJson(responseText));

    const subjectId = Math.random().toString(36).substr(2, 9);
    const colors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const subject: Subject = {
      id: subjectId,
      userId,
      title: subjectTitle,
      difficulty: 'Intermediate',
      examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 4,
      color: colors[Math.floor(Math.random() * colors.length)]
    };

    const topics: Topic[] = (data.topics || []).map((t: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      subjectId,
      title: t.title || 'Topic',
      estimatedHours: t.estimatedHours || 2,
      weightage: t.weightage || 5,
      weaknessScore: t.weaknessScore || 5,
      status: 'Todo' as const
    }));

    return { subject, topics };
  } catch (e) {
    console.error('generateSubjectRoadmap failed:', e);
    return { subject: null as unknown as Subject, topics: [] };
  }
};

export const getTopicDetails = async (topicTitle: string, subjectTitle: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY ?? '';
  const client = new TamboAI({ apiKey });

  const prompt = `
    Provide a concise 3-sentence introduction to the topic "${topicTitle}" in the subject of "${subjectTitle}".
    Then, provide a bulleted list of 3 key sub-concepts to master.
    Finally, suggest a time allocation strategy (e.g., "Spend 2 hours on concept X...").
    Keep it encouraging and directed at an engineering student.
  `;

  try {
    const stream = await client.threads.runs.create({
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      },
      userKey: 'user-1',
      thread: {
        userKey: 'user-1'
      }
    });
    return await parseStreamResponse(stream);
  } catch (e) {
    console.error("AI Details Failed:", e);
    return "Unable to fetch topic details at this time.";
  }
};



/**
 * General purpose AI content generation using Tambo Intelligence
 * @param prompt - The prompt text to send to the AI
 * @returns Generated text response
 */
export const generateContent = async (prompt: string): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_TAMBO_API_KEY ?? '';
    if (!apiKey) {
      console.warn("VITE_TAMBO_API_KEY is missing from environment variables");
      return "AI service not configured.";
    }

    const client = new TamboAI({ apiKey });

    const stream = await client.threads.runs.create({
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      },
      userKey: 'user-1',
      thread: {
        userKey: 'user-1'
      }
    });

    return await parseStreamResponse(stream);
  } catch (error) {
    console.error("Tambo Content Generation Failed:", error);
    return "AI service temporarily unavailable.";
  }
};
