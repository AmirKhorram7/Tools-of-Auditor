# Tauditor Frontend

Next.js (App Router) frontend for the Tauditor internal-auditor platform. It talks to the
Django REST API in the parent folder over JWT.

## Requirements

- Node.js 20+
- Django backend running on `http://127.0.0.1:8000`

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

The app runs on `http://localhost:3000`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:8000/api/v1` | Django API base URL |

The backend must allow the frontend origin via `CORS_ALLOWED_ORIGINS`
(`http://localhost:3000` is allowed by default).

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Phone + OTP sign in / sign up |
| `/dashboard` | Landing page with service picker in the top bar |
| `/profile` | View and complete profile info |
| `/explanation` | System explanation service: project list |
| `/explanation/projects/[id]` | Sub-projects and processes of a project |
| `/explanation/processes/[id]` | Process canvas with draggable step shapes |
| `/explanation/steps/[id]` | Step documentation: explanation / risks / controls |

## Structure

```
src/
├── app/
│   ├── layout.tsx            RTL + Farsi shell, AuthProvider
│   ├── login/                OTP login
│   └── (app)/                Authenticated area (top bar + guard)
├── components/
│   ├── TopBar.tsx            Service picker + user menu
│   ├── RichTextEditor.tsx    RTL contenteditable editor
│   ├── MediaPanel.tsx        Link / image / file attachments
│   ├── StepCanvas.tsx        Draggable process shapes
│   └── ui.tsx                Buttons, inputs, cards, modal
└── lib/
    ├── api.ts                fetch wrapper, JWT refresh, DRF errors
    ├── auth.tsx              Auth context
    └── types.ts              API types
```

## Notes

- Access/refresh tokens are stored in `localStorage`; expired access tokens are
  refreshed automatically once per request.
- In Django `DEBUG` mode the OTP code is printed to the backend console.
- `birth_date` uses Gregorian `YYYY-MM-DD`; Jalali input can be added later.
