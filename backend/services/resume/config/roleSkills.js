
export const ROLE_SKILLS = {
  "mern-stack-developer": {
    label: "MERN Stack Developer",

    required: [
      "JavaScript",
      "React",
      "Node.js",
      "Express.js",
      "MongoDB",
      "HTML",
      "CSS",
      "REST APIs",
      "Git",
    ],

    preferred: [
      "TypeScript",
      "Redux",
      "Tailwind CSS",
      "JWT",
      "Socket.IO",
      "Docker",
      "AWS",
      "Testing",
    ],
  },

  "full-stack-software-engineer": {
    label: "Full-Stack Software Engineer",

    required: [
      "JavaScript",
      "React",
      "Node.js",
      "REST APIs",
      "SQL",
      "NoSQL",
      "Git",
      "Data Structures and Algorithms",
    ],

    preferred: [
      "TypeScript",
      "Docker",
      "Redis",
      "CI/CD",
      "Cloud Computing",
      "System Design",
      "Automated Testing",
    ],
  },

  "java-backend-developer": {
    label: "Java Backend Developer",

    required: [
      "Java",
      "OOP",
      "Spring Boot",
      "REST APIs",
      "SQL",
      "Hibernate",
      "Git",
      "Data Structures and Algorithms",
    ],

    preferred: [
      "Microservices",
      "Docker",
      "Redis",
      "Kafka",
      "JUnit",
      "AWS",
      "CI/CD",
    ],
  },

  "frontend-developer": {
    label: "Frontend Developer",

    required: [
      "HTML",
      "CSS",
      "JavaScript",
      "React",
      "Responsive Design",
      "REST APIs",
      "Git",
    ],

    preferred: [
      "TypeScript",
      "Next.js",
      "Redux",
      "Tailwind CSS",
      "Accessibility",
      "Jest",
      "Performance Optimization",
    ],
  },

  "backend-developer": {
    label: "Backend Developer",

    required: [
      "Node.js",
      "Express.js",
      "REST APIs",
      "SQL",
      "NoSQL",
      "Authentication",
      "Git",
    ],

    preferred: [
      "Microservices",
      "Redis",
      "Docker",
      "AWS",
      "Kafka",
      "CI/CD",
      "Automated Testing",
    ],
  },

  "python-backend-developer": {
    label: "Python Backend Developer",

    required: [
      "Python",
      "REST APIs",
      "SQL",
      "Git",
      "OOP",
      "Authentication",
    ],

    preferred: [
      "Django",
      "FastAPI",
      "Flask",
      "PostgreSQL",
      "Redis",
      "Docker",
      "AWS",
      "Pytest",
    ],
  },

  "qa-automation-engineer": {
    label: "QA Automation Engineer",

    required: [
      "Software Testing",
      "Manual Testing",
      "Automation Testing",
      "Test Cases",
      "Bug Tracking",
      "SQL",
      "API Testing",
    ],

    preferred: [
      "Selenium",
      "Java",
      "Postman",
      "JUnit",
      "TestNG",
      "Cypress",
      "Playwright",
      "CI/CD",
    ],
  },

  "devops-engineer": {
    label: "DevOps Engineer",

    required: [
      "Linux",
      "Git",
      "Docker",
      "CI/CD",
      "Cloud Computing",
      "Scripting",
    ],

    preferred: [
      "Kubernetes",
      "AWS",
      "Jenkins",
      "Terraform",
      "Ansible",
      "Monitoring",
      "Nginx",
    ],
  },

  "data-analyst": {
    label: "Data Analyst",

    required: [
      "SQL",
      "Excel",
      "Python",
      "Data Analysis",
      "Data Visualization",
      "Statistics",
    ],

    preferred: [
      "Power BI",
      "Tableau",
      "Pandas",
      "NumPy",
      "Machine Learning",
      "ETL",
    ],
  },

  "cybersecurity-engineer": {
    label: "Cybersecurity Engineer",

    required: [
      "Network Security",
      "Information Security",
      "Vulnerability Assessment",
      "Linux",
      "Firewalls",
      "Security Operations",
      "Git",
    ],

    preferred: [
      "Penetration Testing",
      "SIEM",
      "Wireshark",
      "SOC",
      "Incident Response",
      "OWASP",
      "Python",
      "Cryptography",
      "Cloud Security",
      "Docker",
    ],
  },

  "ml-engineer": {
    label: "ML Engineer",

    required: [
      "Python",
      "Machine Learning",
      "Data Structures and Algorithms",
      "SQL",
      "Git",
    ],

    preferred: [
      "Deep Learning",
      "PyTorch",
      "TensorFlow",
      "NLP",
      "LLMs",
      "Computer Vision",
      "Scikit-Learn",
      "Docker",
      "MLOps",
      "Pandas",
      "NumPy",
    ],
  },
};

export const SKILL_ALIASES = {
  "Network Security": ["network security", "infosec", "cyber security", "cybersecurity", "security analyst", "security engineering"],
  "Vulnerability Assessment": ["vapt", "vulnerability management", "vulnerability scanning", "vulnerability assessment"],
  "Penetration Testing": ["pentesting", "pen test", "ethical hacking", "metasploit", "burp suite"],
  "SIEM": ["siem", "splunk", "qradar", "sentinel"],
  "Information Security": ["infosec", "information security", "cybersecurity"],
  "Security Operations": ["secops", "soc", "soc analyst", "security operations"],
  "Incident Response": ["incident handling", "dfir", "incident response"],
  "Cryptography": ["encryption", "pki", "cryptography", "ssl", "tls"],
  "Deep Learning": ["deep learning", "neural networks", "dnn", "cnn", "rnn"],
  "PyTorch": ["pytorch"],
  "TensorFlow": ["tensorflow", "tf"],
  "NLP": ["natural language processing", "nlp"],
  "LLMs": ["llm", "large language models", "generative ai", "genai"],
  "JavaScript": ["js", "ecmascript"],
  "TypeScript": ["ts"],
  "Node.js": ["node", "nodejs"],
  "Express.js": ["express", "expressjs"],
  "React": ["reactjs", "react.js"],
  "Next.js": ["nextjs", "next"],
  "MongoDB": ["mongo"],
  "PostgreSQL": ["postgres", "postgresql"],
  "REST APIs": ["rest api", "restful api", "restful apis"],
  "OOP": [
    "object oriented programming",
    "object-oriented programming",
  ],
  "Data Structures and Algorithms": [
    "dsa",
    "data structures",
    "algorithms",
  ],
  "CI/CD": [
    "continuous integration",
    "continuous deployment",
    "continuous delivery",
  ],
  "Automated Testing": ["test automation", "automated tests"],
  "Software Testing": ["software test"],
  "Automation Testing": ["test automation"],
  "Responsive Design": ["responsive web design"],
  "Cloud Computing": ["cloud services", "cloud platforms"],
  "Machine Learning": ["ml"],
  "Artificial Intelligence": ["ai"],
  "Tailwind CSS": ["tailwind"],
  "Redux": ["redux toolkit"],
  "AWS": ["amazon web services"],
  "JWT": ["json web token", "json web tokens"],
  "Socket.IO": ["socket io", "socketio"],
  "Hibernate": ["hibernate orm"],
  "Spring Boot": ["springboot"],
  "Power BI": ["powerbi"],
  "NumPy": ["numpy"],
  "Pandas": ["pandas library"],
  "Pytest": ["pytest framework"],
  "JUnit": ["junit testing"],
  "API Testing": ["api test"],
  "Manual Testing": ["manual software testing"],
  "Automation Testing": ["automated testing"],
};
