export const SUPPORTED_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (High Quality - Groq)', provider: 'groq' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Fast & Lightweight - Groq)', provider: 'groq' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (Coding & Multilingual - Groq)', provider: 'groq' },
  { id: 'grok-beta', label: 'Grok Beta (xAI)', provider: 'xai' }
];

export function getResolvedApiKey(customKey = '') {
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
}

export function isApiKeyConfigured() {
  return Boolean(getResolvedApiKey());
}

/**
 * Dynamically computes an ATS keyword match percentage
 * between candidate resume and job description text.
 */
export function calculateDynamicJdMatch(resume, jdText) {
  if (!jdText || !resume) return null;

  const extractKeywords = (text) => {
    return (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(
      (w) =>
        ![
          'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have',
          'will', 'your', 'about', 'must', 'each', 'such', 'when',
          'what', 'which', 'their', 'work', 'role', 'team', 'help',
          'looking', 'opportunity', 'company', 'equal', 'gender',
          'plus', 'good', 'strong', 'ability', 'degree', 'years'
        ].includes(w)
    );
  };

  const jdKeywords = Array.from(new Set(extractKeywords(jdText)));
  if (jdKeywords.length === 0) return null;

  const resumeText = JSON.stringify(resume).toLowerCase();
  let matches = 0;
  for (const kw of jdKeywords) {
    if (resumeText.includes(kw)) {
      matches += 1;
    }
  }

  const matchRatio = matches / jdKeywords.length;
  return Math.min(98, Math.max(10, Math.round(matchRatio * 100)));
}

/**
 * Executes AI resume tailoring using Groq or xAI Grok.
 */
export async function tailorResume({
  mode = 'jd',
  currentResume,
  jobDescription = '',
  targetRole = '',
  prompt = '',
  apiKey = '',
  model = 'openai/gpt-oss-120b'
}) {
  const effectiveKey = getResolvedApiKey(apiKey);

  if (!effectiveKey) {
    throw new Error(
      'AI API key is missing. Please configure GROQ_API_KEY or GROK_API_KEY in backend .env, or provide an API key in your request.'
    );
  }

  if (mode === 'prompt') {
    if (!prompt || prompt.trim().length < 5) {
      throw new Error('Please provide a clear instruction or prompt for modifying the resume.');
    }
  } else {
    if (!jobDescription || jobDescription.trim().length < 20) {
      throw new Error('Please provide a substantive Job Description (at least a few sentences).');
    }
  }

  let systemPrompt = '';
  let userMessage = '';

  if (mode === 'prompt') {
    systemPrompt = `You are an elite technical resume editor, executive career coach, and ATS specialist.
You are given the candidate's EXACT resume in JSON format and a specific prompt/instruction from the user.

CRITICAL RULES:
1. STRICT SECTION PRESERVATION: You MUST NOT delete, drop, or omit any existing sections under any circumstance.
   You must preserve all sections: personalInfo, summary, skills, experiences, projects, education, and settings.
2. FAITHFUL MODIFICATION: Modify, elevate, rephrase, or expand the content strictly according to the user prompt (e.g. quantifying metrics, emphasizing specific tech stacks, shifting tone, or highlighting leadership) without inventing fake companies or degrees.
3. SINGLE-PAGE CONSTRAINTS: Keep bullet lengths concise (1-2 lines each) so the resume continues to fit strictly on a single A4 page.
4. JSON OUTPUT SCHEMA: You MUST return a strictly valid JSON object matching this exact structure:
{
  "tailoredResume": {
    "personalInfo": {
      "fullName": "...",
      "phone": "...",
      "email": "...",
      "linkedin": "...",
      "location": "..."
    },
    "summary": "...",
    "skills": ["Category: skill, skill", "..."],
    "experiences": [
      {
        "id": "...",
        "jobTitle": "...",
        "companyName": "...",
        "location": "...",
        "dateRange": "...",
        "bullets": ["..."]
      }
    ],
    "projects": [
      {
        "id": "...",
        "projectName": "...",
        "technologies": "...",
        "dateRange": "...",
        "bullets": ["..."]
      }
    ],
    "education": [
      {
        "id": "...",
        "degree": "...",
        "institution": "...",
        "location": "...",
        "dateRange": "...",
        "details": "..."
      }
    ],
    "settings": {
      "fontFamily": "Inter",
      "nameFontFamily": "Cinzel",
      "fontSize": "xs",
      "spacing": "compact"
    }
  },
  "changesSummary": [
    "Specific modification 1 made...",
    "Specific modification 2 made..."
  ],
  "jdMatchScore": <Integer between 75 and 100 representing how thoroughly the prompt goals were satisfied>
}`;

    userMessage = `USER INSTRUCTIONS / PROMPT:
"""
${prompt.trim()}
"""

EXACT CURRENT RESUME JSON:
"""
${JSON.stringify(currentResume, null, 2)}
"""

Execute the user instructions on the resume without deleting or dropping any sections. Return ONLY raw valid JSON.`;
  } else {
    systemPrompt = `You are an elite technical career coach, executive recruiter, and ATS resume specialist.
Your task is to tailor a candidate's resume to match a target Job Description (JD) while strictly adhering to a single-page printable format.

RULES:
1. TRUTHFULNESS: Never invent false companies, fake degrees, or fictional achievements. Reframe, elevate, and highlight genuine experiences, technologies, and achievements to directly address the JD's requirements.
2. ATS KEYWORDS: Naturally weave high-priority keywords from the JD into the Summary, Skills categories, and Experience bullet points.
3. BULLET QUALITY: Keep bullets focused on: Strong Action Verb + Technical Context + Measurable Result or Impact.
4. STRICT SINGLE-PAGE FIT: Ensure bullet points are concise (1-2 lines each, max 3-4 bullets per role) and skills are organized tightly so the entire resume fits effortlessly on 1 single page.
5. PRESERVE CONTACT INFO: Keep personalInfo intact.
6. JSON SCHEMA: You MUST return a strictly valid JSON object matching the following structure:
{
  "tailoredResume": {
    "personalInfo": {
      "fullName": "...",
      "phone": "...",
      "email": "...",
      "linkedin": "...",
      "location": "..."
    },
    "summary": "Tailored 2-3 sentence impactful summary aligned with JD...",
    "skills": [
      "Languages: ...",
      "Frameworks & Libraries: ...",
      "Databases & Messaging: ...",
      "Cloud & DevOps: ...",
      "Core Concepts: ..."
    ],
    "experiences": [
      {
        "id": "exp-1",
        "jobTitle": "Job Title",
        "companyName": "Company Name",
        "location": "City, Country",
        "dateRange": "Date Range",
        "bullets": ["Bullet 1 with metrics...", "Bullet 2..."]
      }
    ],
    "projects": [
      {
        "id": "proj-1",
        "projectName": "Project Name",
        "technologies": "Tech stack",
        "dateRange": "2023",
        "bullets": ["Bullet 1..."]
      }
    ],
    "education": [
      {
        "id": "edu-1",
        "degree": "...",
        "institution": "...",
        "location": "...",
        "dateRange": "...",
        "details": "..."
      }
    ],
    "settings": {
      "fontFamily": "Inter",
      "nameFontFamily": "Cinzel",
      "fontSize": "xs",
      "spacing": "compact"
    }
  },
  "changesSummary": [
    "Specific optimization 1...",
    "Specific optimization 2..."
  ],
  "jdMatchScore": <Integer between 0 and 100 calculated dynamically based on how closely the candidate's genuine experience matches the target JD requirements. Evaluate skills, experience level, and domain. Do not output a constant or default number.>
}`;

    userMessage = `TARGET ROLE: ${targetRole || 'Software Engineer'}

TARGET JOB DESCRIPTION:
"""
${jobDescription.trim()}
"""

CURRENT CANDIDATE RESUME:
"""
${JSON.stringify(currentResume, null, 2)}
"""

Tailor this resume to maximally match the target job description while preserving truthfulness and ensuring it fits strictly on a single page. Output raw JSON only.`;
  }

  // Determine endpoint based on API key prefix or model name
  const isXaiKey = effectiveKey.startsWith('xai-') || model.startsWith('grok');
  const apiEndpoint = isXaiKey
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  const selectedModel = model || (isXaiKey ? 'grok-beta' : 'openai/gpt-oss-120b');

  const requestPayload = {
    model: selectedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2
  };

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveKey}`
    },
    body: JSON.stringify(requestPayload)
  });

  if (!response.ok) {
    let errDetail = '';
    try {
      const rawErrorText = await response.text();
      try {
        const errJson = JSON.parse(rawErrorText);
        errDetail = errJson?.error?.message || errJson?.error || JSON.stringify(errJson);
      } catch {
        errDetail = rawErrorText.slice(0, 300);
      }
    } catch (readErr) {
      errDetail = `Could not read provider response: ${readErr.message}`;
    }
    throw new Error(`AI Provider Error (${response.status}): ${errDetail}`);
  }

  const rawSuccess = await response.text();
  let data;
  try {
    data = JSON.parse(rawSuccess);
  } catch (parseErr) {
    throw new Error(`Failed to parse AI provider response JSON: ${parseErr.message}`);
  }
  const rawContent = data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('Received empty response from AI Provider.');
  }

  // Clean markdown fence blocks if returned
  let cleanJson = rawContent.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    const match = cleanJson.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse AI JSON response: ${parseErr.message}`);
    }
  }

  const tailoredResume = parsed.tailoredResume || (parsed.personalInfo ? parsed : null);
  if (!tailoredResume) {
    throw new Error('AI response did not contain a valid tailored resume object.');
  }

  // CRITICAL SECTION PRESERVATION: Guard against missing sections
  tailoredResume.personalInfo = {
    ...currentResume?.personalInfo,
    ...(tailoredResume.personalInfo || {})
  };

  if (!tailoredResume.summary || tailoredResume.summary.trim().length === 0) {
    tailoredResume.summary = currentResume?.summary || '';
  }

  if (!Array.isArray(tailoredResume.skills) || tailoredResume.skills.length === 0) {
    tailoredResume.skills = currentResume?.skills || [];
  }

  if (!Array.isArray(tailoredResume.experiences) || tailoredResume.experiences.length === 0) {
    tailoredResume.experiences = currentResume?.experiences || [];
  }

  if (!Array.isArray(tailoredResume.projects)) {
    tailoredResume.projects = currentResume?.projects || [];
  }

  if (!Array.isArray(tailoredResume.education) || tailoredResume.education.length === 0) {
    tailoredResume.education = currentResume?.education || [];
  }

  tailoredResume.settings = {
    fontFamily: currentResume?.settings?.fontFamily || 'Inter',
    nameFontFamily: currentResume?.settings?.nameFontFamily || 'Cinzel',
    fontSize: currentResume?.settings?.fontSize || 'xs',
    spacing: currentResume?.settings?.spacing || 'compact',
    accentColor: currentResume?.settings?.accentColor || '#1e293b',
    ...(tailoredResume.settings || {})
  };

  // Match score handling
  let calculatedScore = null;
  if (typeof parsed.jdMatchScore === 'number' && !isNaN(parsed.jdMatchScore)) {
    calculatedScore = Math.min(100, Math.max(0, Math.round(parsed.jdMatchScore)));
  } else if (typeof parsed.jdMatchScore === 'string') {
    const parsedInt = parseInt(parsed.jdMatchScore.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsedInt)) {
      calculatedScore = Math.min(100, Math.max(0, parsedInt));
    }
  }

  if (calculatedScore === null) {
    if (mode === 'prompt') {
      calculatedScore = 92;
    } else {
      calculatedScore = calculateDynamicJdMatch(tailoredResume, jobDescription);
    }
  }

  return {
    tailoredResume,
    changesSummary: Array.isArray(parsed.changesSummary) && parsed.changesSummary.length > 0
      ? parsed.changesSummary
      : [
          'Tailored summary and skills to align with requested goals',
          'Emphasized relevant tech stack and impact metrics',
          'Preserved all sections while optimizing for single-page presentation'
        ],
    jdMatchScore: calculatedScore
  };
}
