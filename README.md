# 🧠 CodeBrain — AI Code Reviewer & Developer Assistant

CodeBrain is an **AI-powered code reviewer and developer assistant** designed to help developers analyze, review, and improve their source code.

The project was built primarily to **explore the real power and capabilities of the Laravel AI SDK** and understand how Laravel can be used to build practical AI-powered developer tools beyond a traditional chatbot.

CodeBrain combines **Laravel 13, Laravel AI SDK, React, Inertia.js, and Google Gemini** to provide an interactive AI development experience.

---

Repository URL => https://github.com/Janaka27/CodeBrain.git
Demo Video URL => https://drive.google.com/file/d/1Y1HiT9WUSNEEGpbuEg8VHYQ8O270z00h/view?usp=sharing

---

## ✨ Features

### 🔍 AI Code Review

Analyze source code and receive AI-powered feedback about:

- Logical errors
- Potential bugs
- Code quality
- Performance problems
- Architecture improvements
- Best-practice recommendations

### 🛡️ Security & Vulnerability Auditing

CodeBrain can analyze code for common security vulnerabilities, including:

- SQL Injection
- Cross-Site Scripting (XSS)
- Authentication issues
- Authorization problems
- Unsafe input handling
- Other potential security weaknesses

### ⚡ Performance & Reliability Analysis

The reviewer can identify potential:

- Performance bottlenecks
- High-concurrency issues
- Memory-related problems
- Uncaught exceptions
- Reliability and resilience issues

### 📂 Multimodal File Analysis

CodeBrain supports providing different types of files as additional context for AI analysis.

This allows developers to give the AI more information about their project instead of relying only on pasted code.

### 📡 Real-Time AI Response Streaming

AI responses are streamed to the frontend using **Server-Sent Events (SSE)**.

Instead of waiting for the entire response, users can see the AI response being generated in real time.

### 🧠 AI Agents & Tool Calling

CodeBrain uses the Laravel AI SDK's agent capabilities to create AI-powered workflows.

Custom tools allow the AI to access additional information when required, such as:

- Current date and time
- Current weather information

### 💬 Conversational AI Memory

The application maintains conversation history so users can continue previous discussions with the AI while preserving relevant context.

### 💻 Developer-Friendly Interface

The interface includes:

- Syntax-highlighted code blocks
- One-click code copying
- Markdown rendering
- File previews
- Image lightbox previews
- Streaming responses
- Chat history
- Undoable chat deletion
- Modern developer-focused UI

---

# 🛠️ Technology Stack

### Backend

- ⚙️ **Laravel 13**
- 🤖 **Laravel AI SDK**
- ✨ **Google Gemini**

### Frontend

- ⚛️ **React**
- 🔗 **Inertia.js**

### AI & Developer Technologies

- 🧠 AI Agents
- 🧩 AI Tool Calling
- 📡 Server-Sent Events (SSE)
- 🔍 AI Code Analysis
- 🛡️ Security/Vulnerability Analysis
- 📂 Multimodal File Processing
- 💬 Conversational AI Memory

---

# 🏗️ Project Architecture

CodeBrain follows a modern full-stack Laravel architecture.

```text
┌──────────────────────────────────────────────┐
│                  CodeBrain                   │
├──────────────────────────────────────────────┤
│                                              │
│              React + Inertia.js              │
│                     │                        │
│                     ▼                        │
│              Laravel 13 Backend              │
│                     │                        │
│                     ▼                        │
│              Laravel AI SDK                  │
│                     │                        │
│          ┌──────────┴──────────┐             │
│          ▼                     ▼             │
│      AI Agents             AI Tools          │
│          │                     │             │
│          ▼                     ▼             │
│      Code Review        External APIs        │
│      Security Audit       Weather API        │
│      General AI          Date/Time           │
│          │                                   │
│          ▼                                   │
│             Google Gemini                    │
│                                              │
└──────────────────────────────────────────────┘
```

---

# 🤖 Laravel AI SDK

A major purpose of CodeBrain was to explore the capabilities of the **Laravel AI SDK**.

The project demonstrates how Laravel AI can be used for:

- AI agent creation
- Conversational AI
- AI tool calling
- Multimodal inputs
- Conversation persistence
- Streaming AI responses
- Model configuration
- AI-powered application workflows

Rather than treating the LLM as a simple API endpoint, CodeBrain uses the AI SDK to build a more structured **AI agent-based application**.

---

# 🔍 Code Review Workflow

The general code review process works like this:

```text
User
 │
 │ Submit Code
 ▼
React + Inertia.js
 │
 ▼
Laravel Controller
 │
 ▼
Review Agent
 │
 ▼
Laravel AI SDK
 │
 ▼
Google Gemini
 │
 ▼
AI Analysis
 │
 ▼
SSE Streaming
 │
 ▼
React UI
```

The AI analyzes the submitted code and returns structured feedback covering areas such as code quality, security, performance, and reliability.

---

# 🛡️ Security Audit Workflow

CodeBrain also provides a dedicated vulnerability analysis mode.

```text
Source Code
     │
     ▼
Security Analysis
     │
     ├── SQL Injection
     ├── XSS
     ├── Authentication
     ├── Authorization
     ├── Input Validation
     └── Other Security Risks
     │
     ▼
AI Generated Report
```

The purpose is to help developers identify potential issues **before deployment**.

> ⚠️ AI-generated security analysis should be treated as an additional review layer and not as a replacement for professional security testing.

---

# 📡 Real-Time Streaming

CodeBrain uses **Server-Sent Events (SSE)** to stream AI responses from the Laravel backend to the React frontend.

Instead of:

```text
Request → Wait → Complete Response
```

the application provides:

```text
Request
   ↓
AI Processing
   ↓
Chunk → Frontend
   ↓
Chunk → Frontend
   ↓
Chunk → Frontend
   ↓
Complete Response
```

This provides a more responsive conversational experience.

---

# 🧠 AI Agents

CodeBrain separates AI responsibilities into specialized agents.

### Chat Agent

Used for:

- General developer assistance
- Technical questions
- Conversational interactions
- Project-related discussions
- Multimodal AI interactions

### Review Agent

Used for:

- Code review
- Bug detection
- Security analysis
- Performance analysis
- Architecture recommendations

This separation allows different AI workflows to have different instructions and responsibilities.

---

# 🧩 AI Tools

CodeBrain also demonstrates how AI agents can interact with custom tools.

Examples include:

### 📅 Current Date & Time

Provides the AI with current date, time, and timezone information.

### 🌤️ Weather

Retrieves weather information using external weather services.

This demonstrates how an AI agent can move beyond generating text and **interact with external functionality through tools**.

---

# 📂 File Analysis

Users can provide files as additional context for AI analysis.

Supported file categories include:

- 📄 PDF
- 📝 Word documents
- 📊 Excel files
- 💻 Source code
- 🖼️ Images
- 📦 ZIP files
- 📃 Text files
- 🎵 Audio
- 🎥 Video

The application determines the appropriate file type and passes it to the AI workflow for processing.

---

# 🚀 Getting Started

## Requirements

Before running CodeBrain, make sure you have the following installed:

- PHP 8.4+
- Composer
- Node.js
- npm
- A supported database
- Google Gemini API key

---

## 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Navigate into the project:

```bash
cd CodeBrain
```

---

## 2. Install PHP Dependencies

```bash
composer install
```

---

## 3. Install Frontend Dependencies

```bash
npm install
```

---

## 4. Configure Environment

Create your environment file:

```bash
cp .env.example .env
```

For Windows:

```bash
copy .env.example .env
```

Generate the Laravel application key:

```bash
php artisan key:generate
```

---

## 5. Add Your Gemini API Key

CodeBrain requires a **Google Gemini API key** to communicate with the AI model.

Open:

```text
.env
```

and configure your Gemini credentials according to the Laravel AI SDK/provider configuration used by the project.

For example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> 🔐 **Important:** Never commit your real API key to GitHub. Keep your `.env` file private.

You can obtain a Gemini API key from Google's AI developer platform.

---

## 6. Configure Database

Configure your database connection in `.env`.

Example:

```env
DB_CONNECTION=sqlite/mysql
```

Or configure MySQL if you prefer to use MySQL.

Then run:

```bash
php artisan migrate
```

---

## 7. Start Application

```bash
composer run dev
```

---

The application should now be available through your local Laravel development server.

---

# 🔐 Environment Variables

Make sure sensitive configuration is stored inside `.env`.

Example:

```env
APP_NAME=CodeBrain
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key

DB_CONNECTION=sqlite
```

The exact environment variables may vary depending on your local configuration.

---

# 📁 Project Structure

A simplified structure of the project:

```text
CodeBrain/
│
├── app/
│   ├── Ai/
│   │   ├── Agents/
│   │   │   ├── ChatAgent.php
│   │   │   └── ReviewAgent.php
│   │   │
│   │   └── Tools/
│   │       ├── GetCurrentDateTime.php
│   │       └── GetCurrentWeather.php
│   │
│   ├── Http/
│   │   └── Controllers/
│   │       └── ChatController.php
│   │
│   └── ...
│
├── database/
│   └── migrations/
│
├── resources/
│   └── js/
│       ├── components/
│       ├── pages/
│       └── ...
│
├── routes/
│
├── .env.example
├── composer.json
├── package.json
└── README.md
```

---

# 🎯 Project Goals

The main goals of CodeBrain were to:

- Explore the capabilities of the Laravel AI SDK
- Understand AI agent architecture
- Integrate Google Gemini into Laravel
- Implement AI tool calling
- Build real-time AI streaming
- Implement conversational AI memory
- Explore multimodal AI processing
- Build an AI-powered security reviewer
- Combine Laravel with React and Inertia.js
- Create a practical AI-powered developer tool

---

# 📚 What I Learned

Building CodeBrain provided hands-on experience with several areas of modern AI application development:

- 🤖 Large Language Model integration
- 🧠 AI agent architecture
- 🧩 Function/tool calling
- 📡 Server-Sent Events
- 💬 Conversational AI
- 📂 Multimodal AI
- 🛡️ AI-assisted security analysis
- ⚡ Real-time frontend updates
- 🔗 Laravel + React integration
- 🏗️ AI application architecture

Most importantly, the project helped me understand how the **Laravel AI SDK can be used to build structured AI applications instead of simply sending prompts to an LLM API.**

---

# ⚠️ Disclaimer

CodeBrain is an experimental developer tool and educational project.

AI-generated code reviews and security findings may not always be accurate. Developers should manually verify recommendations and use dedicated security testing tools for production applications.

Do not upload confidential source code, credentials, API keys, passwords, or other sensitive information.

---

# 🚀 Future Improvements

Some potential future improvements include:

- 🔐 More advanced security vulnerability detection
- 📊 Code quality scoring
- 🧪 Automated test generation
- 🐛 AI-assisted debugging
- 🔄 GitHub repository integration
- 📈 Project-level code analysis
- 🗂️ Repository-wide context
- 🔎 Static analysis integration
- 🤖 More specialized AI agents
- 📋 Exportable code review reports

---

# 👨‍💻 Author

T.M.Janaka Namal Thennakoon

Built with using **Laravel, Laravel AI SDK, React, Inertia.js, and Google Gemini**.

---

If you find this project interesting, consider giving the repository a **⭐** and sharing your feedback!
