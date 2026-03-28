# Course Workbench

**Version 0.3.0**
**Author:** David M. Berry
**Date:** March 2026
**Licence:** MIT

A desktop-style web application for managing Canvas LMS course content locally as Markdown files, with an integrated AI assistant for reviewing and improving module materials.

## What It Does

Course Workbench pulls course content from Canvas LMS, converts it to Markdown with YAML frontmatter, and provides a local editing environment with AI-assisted review. Content can be pushed back to Canvas after editing.

- **Canvas sync.** Pull modules, pages, assignments, rubrics, and discussions from Canvas into a local workspace. Push edited content back.
- **Markdown editor.** CodeMirror-based editor with editorial typography, switchable between raw Markdown and rich-text (Tiptap) views.
- **File tree.** Sidebar file browser for navigating module structures (pages, assignments, rubrics, discussions).
- **AI chat panel.** Integrated AI assistant (Anthropic, OpenAI, or Google) that understands the module structure, can read and edit files, and provides structured module reviews.
- **Institution profiles.** Configurable terminology mapping (programme/module/assessment) via editable Markdown profiles, supporting different institutional conventions.
- **Module review.** The AI assistant can analyse module coherence, level appropriateness, assessment alignment, and structural gaps.

## Architecture

```
config/institutions/       # Institution terminology profiles (Markdown)
src/
  app/
    api/
      browse/              # File system browsing
      canvas/              # Canvas LMS API proxy
      chat/                # AI chat endpoint
      chat-cc/             # Claude Code chat variant
      files/               # File read/write/create/manage
      institutions/        # Institution profile loader
      settings/            # Settings persistence
      test-connection/     # Canvas connection testing
    page.tsx               # Main workspace layout
  components/
    canvas/                # Canvas sync dialogs (pull, push, settings, logs)
    chat/                  # Chat panel, message bubbles, file mentions, edit diffs
    editor/                # Markdown editor, rich-text editor, toolbar, frontmatter
    layout/                # Toolbar, sidebar, content panel, status bar
    settings/              # AI provider settings modal
    sidebar/               # Course list, workspace setup
    tree/                  # File tree browser
  context/                 # AI settings, workspace state
  lib/
    ai/                    # AI client, config, system prompt
    canvas/                # Canvas API client, converters, pull/push logic
    institutions/          # Institution profile parser
    markdown/              # Markdown rendering
  types/                   # TypeScript type definitions
```

## Prerequisites

- Node.js 18+
- API key for at least one AI provider (Anthropic, OpenAI, or Google)
- Canvas LMS API token (for Canvas sync features)

## Getting Started

```bash
git clone https://github.com/dmberry/Course-workbench.git
cd Course-workbench
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

- **AI providers:** Configure via the settings modal (gear icon). API keys are stored in the browser.
- **Canvas connection:** Set your Canvas base URL and API token in Settings or in `canvas-config.local.md`.
- **Institution profile:** Select the active profile in Settings. Default and Sussex profiles are included; add new ones in `config/institutions/`.

## Tech Stack

- Next.js 16, React 19, App Router
- CodeMirror 6 (Markdown editing)
- Tiptap (rich-text editing)
- Tailwind CSS v3
- Vercel AI SDK (Anthropic, OpenAI, Google providers)
- Radix UI (dialogs, menus, tooltips)
- Lucide icons

## Licence

MIT
