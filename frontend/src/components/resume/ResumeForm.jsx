import React, { useState } from 'react';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiLinkedin,
  FiGithub,
  FiFileText,
  FiCpu,
  FiBriefcase,
  FiFolder,
  FiBookOpen,
  FiAward,
  FiPlus,
  FiTrash2,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
  FiZap,
  FiLayers,
  FiExternalLink,
  FiEdit3,
} from 'react-icons/fi';

// Role summary templates for 1-click starter chips
const ROLE_TEMPLATES = [
  {
    role: 'Full-Stack MERN',
    badge: 'MERN Stack',
    text: 'Full-Stack Software Engineer with expertise in building scalable React frontends, robust Node.js/Express APIs, and resilient MongoDB architectures. Proven track record in developing secure RESTful services, integrating real-time communication, and optimizing frontend rendering performance.',
  },
  {
    role: 'Backend & Cloud',
    badge: 'Backend / Cloud',
    text: 'Backend Software Engineer specializing in scalable microservices, distributed system design, relational and NoSQL databases, and cloud infrastructure. Passionate about API efficiency, caching strategies, asynchronous message queues, and high-concurrency architectures.',
  },
  {
    role: 'AI/ML & Data',
    badge: 'AI / Data',
    text: 'Software & Machine Learning Engineer experienced in Python, deep learning frameworks, NLP, and automated data pipelines. Adept at fine-tuning model endpoints, optimizing inference latency, and integrating LLMs into modern web platforms.',
  },
  {
    role: 'Frontend & UI/UX',
    badge: 'Frontend / UI',
    text: 'Frontend Engineer specialized in React, TypeScript, Tailwind CSS, and modular state architecture. Passionate about crafting accessible, pixel-perfect, and lightning-fast web interfaces with modern design systems.',
  },
];

// Quick-add industry skill suggestions
const SUGGESTED_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Express',
  'Python',
  'Java',
  'C++',
  'MongoDB',
  'PostgreSQL',
  'Redis',
  'Docker',
  'AWS',
  'Git',
  'Next.js',
  'System Design',
  'REST APIs',
  'GraphQL',
  'Tailwind CSS',
  'Linux',
];

// Styled form field with leading icon
function StudioInput({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = 'text',
  required = false,
  tip = '',
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {tip && <span className="text-[10px] text-gray-400">{tip}</span>}
      </div>

      <div className="relative flex items-center group">
        {Icon && (
          <div className="absolute left-3.5 text-gray-400 group-focus-within:text-[#111318] transition-colors pointer-events-none">
            <Icon size={14} />
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-gray-200 focus:border-[#111318] focus:ring-2 focus:ring-[#111318]/10 text-gray-900 text-xs rounded-xl ${
            Icon ? 'pl-9' : 'pl-3.5'
          } pr-3.5 py-2.5 outline-none transition shadow-2xs font-medium placeholder-gray-400`}
        />
      </div>
    </div>
  );
}

// Styled textarea with helper notes
function StudioTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  tip = '',
  wordCount = null,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          {label}
        </label>
        {wordCount !== null && (
          <span className="text-[10px] font-mono font-semibold text-gray-400">
            {wordCount} words
          </span>
        )}
      </div>

      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-gray-200 focus:border-[#111318] focus:ring-2 focus:ring-[#111318]/10 text-gray-900 text-xs rounded-xl p-3 outline-none transition shadow-2xs font-medium placeholder-gray-400 leading-relaxed resize-y"
      />
      {tip && <p className="text-[11px] text-gray-400">{tip}</p>}
    </div>
  );
}

// Collapsible entry card for array items
function StudioCard({ index, title, subtitle, onRemove, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl overflow-hidden shadow-2xs transition-all hover:border-gray-300">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200/80">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-[#111318] text-white text-[11px] font-black flex items-center justify-center shrink-0">
            #{index + 1}
          </span>
          <div className="truncate">
            <h4 className="text-xs font-bold text-gray-900 truncate">
              {title || `Entry #${index + 1}`}
            </h4>
            {subtitle && (
              <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
          <span className="text-gray-400 ml-auto mr-2">
            {isOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition flex items-center justify-center cursor-pointer"
          title="Remove item"
        >
          <FiTrash2 size={13} />
        </button>
      </div>

      {isOpen && <div className="p-4 space-y-3.5 bg-white/50">{children}</div>}
    </div>
  );
}

function ResumeForm({ step, data, setData }) {
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isRawSkillsView, setIsRawSkillsView] = useState(false);

  // Helper to update root field
  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper for parsing skills list
  const currentSkillsList = data.skills
    ? data.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const addSkill = (skillName) => {
    const trimmed = (skillName || newSkillInput).trim();
    if (!trimmed) return;

    // Support comma-separated batch input
    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const merged = [...currentSkillsList];
    parts.forEach((p) => {
      if (!merged.includes(p)) merged.push(p);
    });

    updateField('skills', merged.join(', '));
    setNewSkillInput('');
  };

  const removeSkill = (indexToRemove) => {
    const updated = currentSkillsList.filter((_, idx) => idx !== indexToRemove);
    updateField('skills', updated.join(', '));
  };

  // ----------------------------------------------------
  // STEP 1: Personal Information
  // ----------------------------------------------------
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StudioInput
            label="Full Name"
            icon={FiUser}
            placeholder="e.g. Rahul Sharma"
            value={data.name}
            onChange={(v) => updateField('name', v)}
            required
          />

          <StudioInput
            label="Email Address"
            type="email"
            icon={FiMail}
            placeholder="e.g. rahul.sharma@example.com"
            value={data.email}
            onChange={(v) => updateField('email', v)}
            required
          />

          <StudioInput
            label="Phone Number"
            type="tel"
            icon={FiPhone}
            placeholder="e.g. +91 98765 43210"
            value={data.phone}
            onChange={(v) => updateField('phone', v)}
            required
          />

          <StudioInput
            label="Current Location"
            icon={FiMapPin}
            placeholder="e.g. New Delhi, India"
            value={data.location}
            onChange={(v) => updateField('location', v)}
            tip="City, Country"
          />

          <StudioInput
            label="LinkedIn Profile"
            icon={FiLinkedin}
            placeholder="e.g. linkedin.com/in/rahulsharma"
            value={data.linkedin}
            onChange={(v) => updateField('linkedin', v)}
            tip="URL or username"
          />

          <StudioInput
            label="GitHub Profile"
            icon={FiGithub}
            placeholder="e.g. github.com/rahulsharma"
            value={data.github}
            onChange={(v) => updateField('github', v)}
            tip="URL or handle"
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 2: Professional Summary
  // ----------------------------------------------------
  if (step === 2) {
    const wordCount = (data.summary || '').trim()
      ? data.summary.trim().split(/\s+/).length
      : 0;
    const charCount = (data.summary || '').length;

    return (
      <div className="space-y-4">
        {/* ATS Tip Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <FiZap size={16} />
          </div>
          <div>
            <h5 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
              ATS Optimization Tip
            </h5>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
              Craft a punchy 2–4 sentence summary highlighting your primary tech stack, years of experience, and quantifiable results. This section is weighted heavily by recruiters and ATS parsers.
            </p>
          </div>
        </div>

        {/* 1-Click Role Starter Chips */}
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-2">
            1-Click Role Starter Templates (Click to apply)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLE_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => updateField('summary', tmpl.text)}
                className="p-3 text-left bg-[#F8F9FA] hover:bg-white border border-gray-200 hover:border-[#111318] rounded-xl transition shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900 group-hover:text-black">
                    {tmpl.role}
                  </span>
                  <span className="text-[9px] font-semibold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                    {tmpl.badge}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                  {tmpl.text}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <StudioTextarea
            label="Professional Summary Text"
            rows={5}
            placeholder="e.g. Full-Stack Software Engineer with 2+ years of experience building scalable React and Node.js applications..."
            value={data.summary}
            onChange={(v) => updateField('summary', v)}
            wordCount={wordCount}
          />
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span>{charCount} characters</span>
            <span>Recommended: 40–80 words</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 3: Technical Skills
  // ----------------------------------------------------
  if (step === 3) {
    return (
      <div className="space-y-4">
        {/* Toggle between tag builder and raw text */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            Technical Skills ({currentSkillsList.length} Added)
          </span>
          <button
            type="button"
            onClick={() => setIsRawSkillsView(!isRawSkillsView)}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 transition flex items-center gap-1 cursor-pointer"
          >
            <FiEdit3 size={12} />
            <span>{isRawSkillsView ? 'Switch to Tag Builder' : 'Edit as Raw Comma Text'}</span>
          </button>
        </div>

        {isRawSkillsView ? (
          <StudioTextarea
            label="Comma-Separated Skills"
            rows={5}
            placeholder="JavaScript, TypeScript, React, Node.js, Express, MongoDB, Docker, Git"
            value={data.skills}
            onChange={(v) => updateField('skills', v)}
            tip="Separate each skill with a comma. Changes sync to the live preview instantly."
          />
        ) : (
          <div className="space-y-3.5">
            {/* Input with Add button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSkill();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <FiCpu className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Type a skill (e.g. React, Docker, Python) and press Enter..."
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === ',') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className="w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-gray-200 focus:border-[#111318] focus:ring-2 focus:ring-[#111318]/10 text-gray-900 text-xs rounded-xl pl-9 pr-3.5 py-2.5 outline-none transition shadow-2xs font-medium placeholder-gray-400"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#111318] hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <FiPlus size={14} />
                <span>Add Skill</span>
              </button>
            </form>

            {/* Rendered Skill Pills */}
            <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4 min-h-[90px]">
              {currentSkillsList.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">
                  No skills added yet. Type above or click any suggested skill below.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {currentSkillsList.map((skill, idx) => (
                    <span
                      key={idx}
                      className="bg-[#111318] text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs group hover:bg-black transition"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(idx)}
                        className="w-3.5 h-3.5 rounded-full hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick-Add Suggestions */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">
                Quick-Add Industry Recommendations
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_SKILLS.map((item, idx) => {
                  const alreadyAdded = currentSkillsList.includes(item);
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addSkill(item)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        alreadyAdded
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 opacity-60 cursor-default'
                          : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {alreadyAdded ? <FiCheck size={11} className="text-emerald-600" /> : <FiPlus size={11} />}
                      <span>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 4: Work Experience
  // ----------------------------------------------------
  if (step === 4) {
    const experiences = data.experience || [];

    const addExp = () => {
      updateField('experience', [
        ...experiences,
        { company: '', role: '', duration: '', location: '', description: '' },
      ]);
    };

    const removeExp = (idx) => {
      updateField(
        'experience',
        experiences.filter((_, i) => i !== idx)
      );
    };

    const updateExpItem = (idx, field, value) => {
      const updated = experiences.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      );
      updateField('experience', updated);
    };

    return (
      <div className="space-y-4">
        {experiences.length === 0 && (
          <div className="bg-[#F8F9FA] border border-dashed border-gray-300 rounded-2xl p-6 text-center text-xs text-gray-500">
            No work experience added yet. Add past jobs, internships, or freelance roles.
          </div>
        )}

        <div className="space-y-3">
          {experiences.map((exp, idx) => (
            <StudioCard
              key={idx}
              index={idx}
              title={exp.role || 'Job / Internship Role'}
              subtitle={exp.company ? `${exp.company} • ${exp.duration || 'Timeline'}` : ''}
              onRemove={() => removeExp(idx)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="Company / Organization"
                  icon={FiBriefcase}
                  placeholder="e.g. ABC Technologies"
                  value={exp.company}
                  onChange={(v) => updateExpItem(idx, 'company', v)}
                />
                <StudioInput
                  label="Role / Title"
                  icon={FiUser}
                  placeholder="e.g. Backend Software Engineer"
                  value={exp.role}
                  onChange={(v) => updateExpItem(idx, 'role', v)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="Duration / Timeline"
                  icon={FiClock}
                  placeholder="e.g. Jan 2023 – Present"
                  value={exp.duration}
                  onChange={(v) => updateExpItem(idx, 'duration', v)}
                />
                <StudioInput
                  label="Location / Work Mode"
                  icon={FiMapPin}
                  placeholder="e.g. Bengaluru, India (Hybrid)"
                  value={exp.location}
                  onChange={(v) => updateExpItem(idx, 'location', v)}
                />
              </div>

              <StudioTextarea
                label="Responsibilities & Impact"
                rows={4}
                placeholder="• Engineered scalable REST APIs using Node.js and MongoDB serving 50k+ daily users&#10;• Reduced database query latency by 40% through Redis caching and query indexing&#10;• Automated CI/CD deployment pipelines on Docker"
                value={exp.description}
                onChange={(v) => updateExpItem(idx, 'description', v)}
                tip="Use bullet points (•) starting with strong action verbs (Built, Led, Optimized)."
              />
            </StudioCard>
          ))}
        </div>

        <button
          type="button"
          onClick={addExp}
          className="w-full py-3.5 border-2 border-dashed border-gray-300 hover:border-[#111318] text-gray-600 hover:text-[#111318] bg-gray-50/50 hover:bg-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <FiPlus size={14} />
          <span>Add Work Experience / Internship</span>
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 5: Projects
  // ----------------------------------------------------
  if (step === 5) {
    const projects = data.projects || [];

    const addProj = () => {
      updateField('projects', [
        ...projects,
        { name: '', techStack: '', github: '', demo: '', description: '' },
      ]);
    };

    const removeProj = (idx) => {
      updateField(
        'projects',
        projects.filter((_, i) => i !== idx)
      );
    };

    const updateProjItem = (idx, field, value) => {
      const updated = projects.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      );
      updateField('projects', updated);
    };

    return (
      <div className="space-y-4">
        {projects.length === 0 && (
          <div className="bg-[#F8F9FA] border border-dashed border-gray-300 rounded-2xl p-6 text-center text-xs text-gray-500">
            No projects added yet. Highlight technical projects that demonstrate real domain competence.
          </div>
        )}

        <div className="space-y-3">
          {projects.map((proj, idx) => (
            <StudioCard
              key={idx}
              index={idx}
              title={proj.name || 'Project Title'}
              subtitle={proj.techStack || 'Technologies Used'}
              onRemove={() => removeProj(idx)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="Project Title"
                  icon={FiFolder}
                  placeholder="e.g. InterviewIQ AI Platform"
                  value={proj.name}
                  onChange={(v) => updateProjItem(idx, 'name', v)}
                />
                <StudioInput
                  label="Technologies Used"
                  icon={FiCpu}
                  placeholder="e.g. React, Node.js, Redis, Docker"
                  value={proj.techStack}
                  onChange={(v) => updateProjItem(idx, 'techStack', v)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="GitHub Repository Link"
                  icon={FiGithub}
                  placeholder="e.g. github.com/user/project"
                  value={proj.github}
                  onChange={(v) => updateProjItem(idx, 'github', v)}
                />
                <StudioInput
                  label="Live Demo Link (Optional)"
                  icon={FiExternalLink}
                  placeholder="e.g. project-live.vercel.app"
                  value={proj.demo}
                  onChange={(v) => updateProjItem(idx, 'demo', v)}
                />
              </div>

              <StudioTextarea
                label="Project Overview & Technical Contributions"
                rows={3}
                placeholder="• Architected full-stack real-time collaboration with WebRTC and Socket.IO&#10;• Implemented JWT authentication and role-based access control with rate limiting"
                value={proj.description}
                onChange={(v) => updateProjItem(idx, 'description', v)}
                tip="Mention key architectural decisions, problem solving, and metrics achieved."
              />
            </StudioCard>
          ))}
        </div>

        <button
          type="button"
          onClick={addProj}
          className="w-full py-3.5 border-2 border-dashed border-gray-300 hover:border-[#111318] text-gray-600 hover:text-[#111318] bg-gray-50/50 hover:bg-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <FiPlus size={14} />
          <span>Add Technical Project</span>
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 6: Education
  // ----------------------------------------------------
  if (step === 6) {
    const education = data.education || [];

    const addEdu = () => {
      updateField('education', [
        ...education,
        { college: '', degree: '', branch: '', cgpa: '', year: '' },
      ]);
    };

    const removeEdu = (idx) => {
      updateField(
        'education',
        education.filter((_, i) => i !== idx)
      );
    };

    const updateEduItem = (idx, field, value) => {
      const updated = education.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      );
      updateField('education', updated);
    };

    return (
      <div className="space-y-4">
        {education.length === 0 && (
          <div className="bg-[#F8F9FA] border border-dashed border-gray-300 rounded-2xl p-6 text-center text-xs text-gray-500">
            No education entries added yet. Add your university degree, diploma, or school background.
          </div>
        )}

        <div className="space-y-3">
          {education.map((edu, idx) => (
            <StudioCard
              key={idx}
              index={idx}
              title={edu.degree ? `${edu.degree} in ${edu.branch || 'Branch'}` : 'Academic Qualification'}
              subtitle={edu.college || 'College / University'}
              onRemove={() => removeEdu(idx)}
            >
              <StudioInput
                label="College / University Name"
                icon={FiBookOpen}
                placeholder="e.g. GLA University, Mathura"
                value={edu.college}
                onChange={(v) => updateEduItem(idx, 'college', v)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="Degree"
                  icon={FiAward}
                  placeholder="e.g. B.Tech, B.S., M.Tech"
                  value={edu.degree}
                  onChange={(v) => updateEduItem(idx, 'degree', v)}
                />
                <StudioInput
                  label="Branch / Major"
                  icon={FiLayers}
                  placeholder="e.g. Computer Science & Engineering"
                  value={edu.branch}
                  onChange={(v) => updateEduItem(idx, 'branch', v)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StudioInput
                  label="CGPA / Percentage"
                  icon={FiAward}
                  placeholder="e.g. 8.6 / 10 or 85%"
                  value={edu.cgpa}
                  onChange={(v) => updateEduItem(idx, 'cgpa', v)}
                />
                <StudioInput
                  label="Graduation Timeline"
                  icon={FiClock}
                  placeholder="e.g. 2021 – 2025"
                  value={edu.year}
                  onChange={(v) => updateEduItem(idx, 'year', v)}
                />
              </div>
            </StudioCard>
          ))}
        </div>

        <button
          type="button"
          onClick={addEdu}
          className="w-full py-3.5 border-2 border-dashed border-gray-300 hover:border-[#111318] text-gray-600 hover:text-[#111318] bg-gray-50/50 hover:bg-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <FiPlus size={14} />
          <span>Add Academic Background</span>
        </button>
      </div>
    );
  }

  return null;
}

export default ResumeForm;
