# Employee Leave Management System

## Overview

This repository contains a full-stack Employee Leave Management System built with:

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Prisma 7, PostgreSQL
- **Authentication:** JWT-based auth with role-based authorization

The system supports employees applying for leave, managers approving/rejecting leave requests, and admins managing users, leave types, and reports.

## Implemented Features

- JWT authentication and secure password hashing
- Role-based access control for Employee, Manager, and Admin
- Employee leave application, history, cancellation, and balance tracking
- Manager team request review and approval/rejection workflow
- Automatic leave balance deduction on approval
- Admin user management and leave type management
- Admin reports for leave summaries and leave balances
- PostgreSQL database with Prisma ORM and seeded demo data
- Backend and frontend tests with Vitest
- Production-ready Next.js build

## Permissions

### Employee

- Login and view dashboard
- Apply for leave
- View own leave history and balances
- Cancel pending leave requests

### Manager

- Login and view team requests
- Approve or reject direct team leave requests
- View leave request status for managed employees

### Admin

- Login and manage users
- Manage leave types
- View admin reports for leave balances and summaries

## Tech Stack

- Node.js
- Express
- Prisma 7
- PostgreSQL
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Vitest

## Project Structure

- `server/` - Backend source, Prisma schema, API routes
- `client/` - Frontend Next.js app
- `server/prisma/` - Prisma schema and seed data

## Prerequisites

- Node.js 22+
- PostgreSQL database
- Git

## Required Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL` (frontend; optional if running backend locally at `http://localhost:5000`)

## Backend Setup

```bash
cd server
npm install
npx prisma generate
npm run build
```

## Frontend Setup

```bash
cd client
npm install
npm run build
```

## Seed Command

```bash
cd server
npm run seed
```

## Run Commands

### Backend

```bash
cd server
npm run dev
```

### Frontend

```bash
cd client
npm run dev
```

## Test Commands

### Backend

```bash
cd server
npm run test
```

### Frontend

```bash
cd client
npm run test
```

## Demo Credentials (demo only)

- Admin: `admin@example.com`
- Manager: `manager@example.com`
- Employee: `employee@example.com`
- Password: `Demo@123`

## API Summary

### Auth

- `POST /api/auth/login`

### Users

- `GET /api/users` (Admin)
- `POST /api/users` (Admin)
- `GET /api/users/me`

### Leave Types

- `GET /api/leave-types`
- `POST /api/leave-types` (Admin)

### Leave Requests

- `GET /api/leave-requests`
- `POST /api/leave-requests`
- `PUT /api/leave-requests/:id`

### Reports

- `GET /api/reports/leave-summary`
- `GET /api/reports/leave-balance`

## Verification Summary

- Backend build: passed
- Backend tests: passed
- Frontend build: passed
- Frontend tests: passed
- Health endpoint: verified
- Seed: verified

## Deployment Notes

- Run `npx prisma generate` after updating `schema.prisma`
- Ensure `DATABASE_URL` and `JWT_SECRET` are configured in production
- Set `NEXT_PUBLIC_API_URL` to the deployed backend URL for the frontend

## Known Limitations

- Demo credentials are for development only
- No email notifications are implemented
- No frontend route protection beyond role-based UI control

  - A clear title (e.g., "Intern Submission: [Your Name]")
  - A description of your implementation
  - Any assumptions or challenges faced
6. **Include a README**: Update the README with:
  - Setup instructions
  - Features implemented
  - Screenshots or a short demo video (optional but encouraged)
  - **Unit test results** (screenshots or logs)
  - **Deployment link** (if deployed)

## 💡 Tips for Interns

- **Refer to Docs**:
  - [Next.js Docs](https://nextjs.org/docs)
  - [Prisma Docs](https://www.prisma.io/docs)
  - [Express Docs](https://expressjs.com/)
  - [Jest Docs](https://jestjs.io/docs/getting-started)
  - [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)

- **Ask for Help**: If stuck, ask for clarification on requirements or concepts.

## Additional Notes

- **Bonus Points**:
  - Leave calendar with drag-and-drop
  - Integration tests or E2E tests
## 🤝 Need Help?

Reach out to the team via email for any questions or clarifications!
