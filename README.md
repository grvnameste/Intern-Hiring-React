# Intern-Hiring-React
A full-stack project for intern evaluation (React + Next.js + Node.js + PostgreSQL).

## 🎯 Project Overview

The **Employee Leave Management System** is a **full-stack web application** designed to evaluate interns on their proficiency in **React, Next.js, Node.js, and PostgreSQL**. This system allows employees to apply for leaves, managers to approve/reject leave requests, and admins to manage users, view reports, and oversee the entire system.

**Expected Completion Time:** 1 week  
**Tech Stack:** React, Next.js (App Router), Node.js, Express, PostgreSQL, Prisma ORM

---

## Roles and Permissions

| Role         | Permissions                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------- |
| **Employee** | Apply for leave, view own leave history, view leave balance, cancel own leave requests      |
| **Manager**  | Approve/reject leave requests, view team leave requests, view team leave reports            |
| **Admin**    | Manage users (CRUD), view all leave requests, generate reports, manage leave types/policies |

---

## Features to Implement

### 1. **User Authentication & Authorization**

- User registration (Admin can create users)
- User login/logout 
- Role-based access control (Employee, Manager, Admin)
- Password hashing

### 2. **Leave Management**

- **Employee:**
  - Apply for leave (type, start date, end date, reason)
  - View own leave history and balance
  - Cancel own pending leave requests
- **Manager:**
  - View leave requests from their team
  - Approve/reject leave requests
  - View team leave calendar
- **Admin:**
  - Manage leave types (e.g., Annual, Sick, Maternity)
  - Set leave policies (e.g., max days per type)

### 3. **Leave Request Workflow**

- Employee submits a leave request → Manager receives notification
- Manager approves/rejects → Employee receives notification
- System updates leave balance automatically

### 4. **Reports (Admin Only)**

- **Leave Summary Report:** Total leaves taken by type, department, or employee
- **Leave Balance Report:** Remaining leave balance for all employees
- **Leave Calendar:** Visual representation of leaves (by team or company-wide)
- Export reports as **CSV/Excel** (bonus)

### 5. **Database Schema (PostgreSQL + Prisma)**

- **User:** id, name, email, password, role (Employee/Manager/Admin), managerId (for reporting hierarchy)
- **LeaveType:** id, name (e.g., Annual, Sick), maxDays
- **LeaveRequest:** id, userId, leaveTypeId, startDate, endDate, status (Pending/Approved/Rejected), reason, createdAt
- **LeaveBalance:** id, userId, leaveTypeId, balance (auto-updated)

### 6. **API Endpoints (RESTful)**

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`
- **Users:** `GET /api/users` (Admin), `POST /api/users` (Admin), `GET /api/users/me`
- **Leave Types:** `GET /api/leave-types`, `POST /api/leave-types` (Admin)
- **Leave Requests:**
  - `GET /api/leave-requests` (Employee: own, Manager: team, Admin: all)
  - `POST /api/leave-requests` (Employee)
  - `PUT /api/leave-requests/:id` (Manager: approve/reject, Employee: cancel)
- **Reports:** `GET /api/reports/leave-summary`, `GET /api/reports/leave-balance` (Admin)

### 7. **Frontend (Next.js App Router)**

- **Pages:**
  - Login
  - Dashboard (role-specific)
  - Leave Application (Employee)
  - Leave Requests (Manager)
  - User Management (Admin)
  - Reports (Admin)
- **UI Requirements:**
  - Responsive design (Tailwind CSS recommended)
  - Form validation (client-side + server-side)
  - Loading states and error handling
  - Notifications (toast messages for actions)

---


### Prerequisites

- Node.js (v22+)
- PostgreSQL (local or Docker)
- Git
- Basic knowledge of TypeScript (recommended)

### Local Development Setup

#### 1. **Clone the Repository**

```bash
git clone https://github.com/grvnameste/Intern-Hiring-React.git
cd Intern-Hiring-React
```

#### 2. **Backend Setup**

- Navigate to the backend directory:

  cd server

#### 3. **Frontend Setup**

- Navigate to the frontend directory:
    cd ../client
  

## 🧪 Unit Testing

**Note:** Your project **must include unit tests** for both backend and frontend to ensure reliability and correctness.

### Backend Testing

- Use **Jest** or **Vitest** to test:
  - API endpoints (e.g., auth, leave requests, user management)
  - Database operations (Prisma queries)
  - Authentication middleware
  - Input validation and error handling
- Example test cases:
  - Test user registration and login
  - Test leave request creation, approval, and rejection
  - Test role-based access control

### Frontend Testing

- Use **Jest** + **React Testing Library** to test:
  - Component rendering and interactions
  - Form submissions and validations
  - API integration (mock API calls)
- Example test cases:
  - Test login form submission
  - Test leave application form validation
  - Test role-based UI rendering (e.g., Admin sees user management, Employee does not)

### Running Tests

- Backend:
  ```bash
  npm run test
  ```
- Frontend:
  ```bash
  npm run test
  ```


## 🚀 Deployment Instructions

**Note:** Your project **must include deployment instructions** to demonstrate how to deploy the application in a production-like environment.

### Option 1: Deploy to Vercel (Frontend) + Render (Backend)

#### Frontend (Next.js) on Vercel

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and import your repository.
3. Configure the following environment variables in Vercel:
  ```env
   NEXT_PUBLIC_API_URL=<your-backend-url>
  ```
4. Deploy the frontend.

#### Backend (Node.js) on Render

1. Go to [Render](https://render.com/) and create a new **Web Service**.
2. Connect your GitHub repository and select the `server` directory.
3. Configure the following environment variables in Render:
  ```env
   DATABASE_URL=<your-postgresql-connection-string>
   JWT_SECRET=your_jwt_secret_here
   PORT=5000
  ```
4. Set the build command to:
  ```bash
   npm install && npx prisma generate
  ```
5. Set the start command to:
  ```bash
   npm start
  ```
6. Deploy the backend.

### Option 2: Deploy to Railway

1. Go to [Railway](https://railway.app/) and create a new project.
2. Add a **PostgreSQL** service and note the connection string.
3. Add a **Node.js** service for the backend and connect it to the PostgreSQL service.
4. Set the environment variables for the backend:
  ```env
   DATABASE_URL=<railway-postgresql-connection-string>
   JWT_SECRET=your_jwt_secret_here
   PORT=5000
  ```
5. Deploy the backend.
6. Add another **Node.js** service for the frontend (Next.js) and set:
  ```env
   NEXT_PUBLIC_API_URL=<your-backend-url>
  ```
7. Deploy the frontend.

### General

- Git best practices (meaningful commits, branches, pull requests)
- Code readability and organization
- Documentation (comments, README updates)
- Ability to complete the project within 1 week



##  Submission Guidelines

1. **Fork the Repository**: Create a fork of the provided repository.
2. **Create a Branch**: Work on a branch named `intern-<your-name>`.
3. **Commit Regularly**: Make small, meaningful commits.
4. **Push to GitHub**: Push your branch to your fork.
5. **Submit a Pull Request**: Open a PR to the main repository with:
  - A clear title (e.g., "Intern Submission: [Your Name]")
  - A description of your implementation
  - Any assumptions or challenges faced
6. **Include a README**: Update the README with:
  - Setup instructions
  - Features implemented
  - Screenshots or a short demo video (optional but encouraged)
  - **Unit test results** (screenshots or logs)
  - **Deployment link** (if deployed)

---

## 💡 Tips for Interns

- **Refer to Docs**:
  - [Next.js Docs](https://nextjs.org/docs)
  - [Prisma Docs](https://www.prisma.io/docs)
  - [Express Docs](https://expressjs.com/)
  - [Jest Docs](https://jestjs.io/docs/getting-started)
  - [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)

- **Ask for Help**: If stuck, ask for clarification on requirements or concepts.

---

## 📌 Additional Notes

- **Bonus Points**:
  - Leave calendar with drag-and-drop
  - Integration tests or E2E tests

---

## 🤝 Need Help?

Reach out to the team via email for any questions or clarifications!